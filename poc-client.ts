import { create } from "@bufbuild/protobuf";
import * as decoding from "lib0/decoding";
import * as Y from "yjs";

import { type ClientLiveData } from "@paperxlab/protos/paperxlab/updates/v1/live_data_pb";
import {
  ApplyUpdatesRequestSchema,
  BlockUpdatePayloadSchema,
  type Branch,
  BranchUpdatePayloadSchema,
  type BranchUpdateResult,
  GetActiveBranchesRequestSchema,
  type GetActiveBranchesResponse,
  GetCheckpointRequestSchema,
  type GetCheckpointResponse,
  GetForkPointRequestSchema,
  type GetForkPointResponse,
  Sync2RequestSchema,
} from "@paperxlab/protos/paperxlab/updates/v1/updates_pb";
import {
  debug,
  debugError,
  EventEmitter,
  pbBlockTypeToY,
  strictCreate,
  type YBlockType,
  yBlockTypeToPb,
} from "@paperxlab/shared";

import type { ClientUpdateVersions } from "./client-update-versions.js";
import {
  clearClientUpdateVersions,
  increaseClientUpdateVersion,
} from "./client-update-versions.js";
import { updatesServiceClient } from "./connect-clients.js";
import { SubscriptionSet } from "./subscription-set.js";
import { UpdateVersion } from "./update-version.js";
import { WriteQueue } from "./write-queue.js";

type OfflineMode = "off" | "update-only" | "full";

type WriteSendMode = "auto" | "manual";

export interface XYClientOptions {
  offlineMode?: OfflineMode;
  writeSendMode?: WriteSendMode;
}

/**
 * 一つの NanoStore に対して、一つの XYClient が作られることを保証するための WeakMap
 */
const storeClientsMap = new WeakMap<Y.NanoStore, XYClient>();

type SaveResult = {
  success: boolean;
  successBlockIds?: Set<string>;
  updateVersions?: Map<Y.NanoBlock, number>;
};

function getBranchDocName(params: {
  docName: string;
  branchId: string;
}): string {
  return `${params.docName}___${params.branchId}`;
}

function parseBranchDocName(name: string): {
  docName: string;
  branchId: string;
} {
  const parts = name.split("___");
  if (parts.length !== 2) {
    throw new Error(`Invalid branch doc name: ${name}`);
  }
  return { docName: parts[0]!, branchId: parts[1]! };
}

/**
 * 汎用的な Y.NanoStore と、Mergelight 用のバックエンドとの連携を行うためのクラス
 */
export class XYClient {
  offlineMode: OfflineMode = "off";
  writeSendMode: WriteSendMode = "auto";

  store: Y.NanoStore;

  #updateVersions = new WeakMap<Y.NanoBlock, UpdateVersion>();

  /**
   * Block の dirty check のために、その block に local な変更があるごとにインクリメントされる
   */
  #clientUpdateVersions: ClientUpdateVersions = new Map();

  /**
   * Updates queue to be sent to server.
   */
  private _writeQueue: WriteQueue<SaveResult>;

  /**
   * Manual mode: pending updates per block until flush.
   */
  private _writePendingUpdates: Map<Y.NanoBlock, Uint8Array[]> = new Map();
  private _writePendingClientUpdateVersions: ClientUpdateVersions = new Map();

  /**
   * Manage subscriptions.
   */
  subscriptionSet: SubscriptionSet;

  destroyed = false;

  /**
   * Checkpoint cache (read-only snapshots, TTL based)
   */
  private _checkpointStates = new Map<
    string,
    {
      docName: string;
      checkpointId: string;
      rootBlockName: string;
      loaded: boolean;
      expiresAt?: number;
      inflight?: Promise<void>;
    }
  >();
  private _checkpointGcTimer?: NodeJS.Timeout;

  /**
   * WriteQueue の保存の成功を待つ callback のリスト
   * key は WriteQueue の item.id
   */
  private successWaitings = new Map<number, Array<() => void>>();
  private activeSaveErrorItemIds = new Set<number>();

  private emitter = new EventEmitter<{
    clientLiveData: (
      branch: { docName: string; branchId: string },
      data: ClientLiveData[]
    ) => void;
    saveError: () => void;
    saveRecovered: () => void;
  }>();

  on = this.emitter.on.bind(this.emitter);
  off = this.emitter.off.bind(this.emitter);
  once = this.emitter.once.bind(this.emitter);

  constructor(store: Y.NanoStore, options: XYClientOptions = {}) {
    if (storeClientsMap.has(store)) {
      throw new Error("BabelClient already created for this store");
    }
    storeClientsMap.set(store, this);
    this.store = store;
    if (options.offlineMode) {
      this.offlineMode = options.offlineMode;
    }
    if (options.writeSendMode) {
      this.writeSendMode = options.writeSendMode;
    }

    this.subscriptionSet = new SubscriptionSet();
    this.subscriptionSet.on("data", (branch, data) => {
      if (data.branch) {
        this.onData([data.branch]);
      }
      if (data.clientLiveData.length > 0) {
        this.emitter.emit("clientLiveData", branch, data.clientLiveData);
      }
    });

    this._writeQueue = new WriteQueue(this.saveUpdates);
    this.runWriteQueue().catch((e) => {
      debugError("Error in runWriteQueue", e);
    });

    // Periodically GC checkpoint cache entries by TTL
    this._checkpointGcTimer = setInterval(() => {
      this.collectCheckpointGarbage();
    }, 10_000);
  }

  addEventListeners() {
    this.store.on("updateV2", this.onUpdateV2);
    this.store.on("destroy", this.onDestroy);
    return () => {
      this.store.off("updateV2", this.onUpdateV2);
      this.store.off("destroy", this.onDestroy);
    };
  }

  destroy() {
    this.destroyed = true;
    this.subscriptionSet.destroy();
    if (this._checkpointGcTimer) {
      clearInterval(this._checkpointGcTimer);
      this._checkpointGcTimer = undefined;
    }
  }

  /**
   * Whether there are write-pending unsent updates in manual mode.
   */
  hasWritePending(): boolean {
    return this._writePendingUpdates.size > 0;
  }

  /**
   * Flush write-pending updates in manual mode by enqueuing them to the write queue.
   * In auto mode, this is a no-op.
   */
  async flushWrites(): Promise<void> {
    if (this.writeSendMode !== "manual") return;
    if (this._writePendingUpdates.size === 0) return;

    // Merge per-block updates into single update per block for enqueue
    const merged: Map<Y.NanoBlock, Uint8Array> = new Map();
    for (const [block, updates] of this._writePendingUpdates) {
      // Use Y.mergeUpdates to combine V2 updates as a single binary
      const combined =
        updates.length === 1 ? updates[0]! : Y.mergeUpdates(updates);
      merged.set(block, combined);
    }

    this._writeQueue.enqueue(
      merged,
      new Map(this._writePendingClientUpdateVersions)
    );

    // Clear pending buffers
    this._writePendingUpdates.clear();
    this._writePendingClientUpdateVersions.clear();

    // Wait until the enqueued item(s) are saved successfully
    await this.waitForCurrentLastItemSaved();
  }

  get clientIdStr() {
    return this.store.clientID.toString();
  }

  getRootBlock(docName: string, branchId: string) {
    const ydocName = getBranchDocName({ docName, branchId });
    return this.store.getRootBlock(ydocName);
  }

  getRootBlockOrCreate(
    docName: string,
    branchId: string,
    type: YBlockType
  ): Y.NanoBlock {
    const rootBlock = this.store.getRootBlockOrCreate(
      getBranchDocName({ docName, branchId }),
      type
    );
    return rootBlock;
  }

  getRootBlockInfo(rootBlock: Y.NanoBlock): {
    docName: string;
    branchId: string;
  } {
    const name = rootBlock.name;
    if (!name) {
      throw new Error("Root block has no name");
    }
    const { docName, branchId } = parseBranchDocName(name);
    return { docName, branchId };
  }

  getUpdateVersion(block: Y.NanoBlock) {
    const updateVersion = this.#updateVersions.get(block);
    if (updateVersion) {
      return updateVersion.currentVersion;
    }
    return 0;
  }

  getClientUpdateVersion(block: Y.NanoBlock) {
    return this.#clientUpdateVersions.get(block) ?? 0;
  }

  async runWriteQueue() {
    for await (const item of this._writeQueue.run()) {
      if (item.status === "success") {
        if (item.hasError) {
          this.resolveActiveSaveError(item.id);
        }
        // clientUpdateVersions をクリア
        if (item.clientUpdateVersions) {
          clearClientUpdateVersions(
            this.#clientUpdateVersions,
            item.clientUpdateVersions
          );
          if (this.#clientUpdateVersions.size === 0) {
            // debug("All client updates are completely saved to the server");
          }
        }
        // updateVersion を更新
        if (item.res?.updateVersions) {
          for (const [block, version] of item.res.updateVersions) {
            this.updateUpdateVersion(block, version);
          }
        }
        // successWaitings を実行
        for (const [waitingId, callbacks] of this.successWaitings) {
          // 以下の条件にマッチする場合、待っている item は成功したとみなす
          // - その item が sync で、waitingId 以上の id を持つ
          // - その item が waitingId である
          // - その item が waitingId にマージされている
          if (
            (item.isSync && item.id >= waitingId) ||
            item.id === waitingId ||
            item.mergedIds.includes(waitingId)
          ) {
            debug(`WriteQueue item ${item.id} succeeded`);
            for (const callback of callbacks) {
              callback();
            }
            this.successWaitings.delete(waitingId);
          }
        }
      } else if (item.hasError) {
        this.addActiveSaveError(item.id);
        // TODO: 解決できないエラーが発生していたら、sync を実行する
        debugError(`WriteQueue item ${item.id} failed`);
      }
    }
  }

  /**
   * 現時点での最新のデータがバックエンドに保存されるのを待つ
   */
  async waitForCurrentLastItemSaved() {
    const lastId = this._writeQueue.lastPendingItemId;
    if (lastId == null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const waitings = this.successWaitings.get(lastId) ?? [];
      waitings.push(resolve);
      this.successWaitings.set(lastId, waitings);
    });
  }

  private addActiveSaveError(itemId: number) {
    const hadError = this.activeSaveErrorItemIds.size > 0;
    this.activeSaveErrorItemIds.add(itemId);
    if (!hadError) {
      this.emitter.emit("saveError");
    }
  }

  private resolveActiveSaveError(itemId: number) {
    if (!this.activeSaveErrorItemIds.has(itemId)) {
      return;
    }
    this.activeSaveErrorItemIds.delete(itemId);
    if (this.activeSaveErrorItemIds.size === 0) {
      this.emitter.emit("saveRecovered");
    }
  }

  // FIXME: Accept branchId
  handleIsolatedResults(
    rootBlockName: string,
    results: Map<
      string,
      { blockType: Y.BlockType; updates: Uint8Array[]; updateVersion: number }
    >
  ) {
    const rootBlock = this.store.getRootBlock(rootBlockName);
    if (!rootBlock) {
      console.warn(`Root block with name ${rootBlockName} not found`);
      return;
    }
    Y.transactInStore(
      this.store,
      () => {
        for (const [
          blockId,
          { blockType, updates, updateVersion },
        ] of results) {
          const block = rootBlock.getOrCreateBlock(blockId, blockType);
          for (const update of updates) {
            Y.applyUpdateV2(block, update);
          }
          this.updateUpdateVersion(block, updateVersion);
        }
      },
      null,
      // remote から発生したものと同じ扱いとする
      false
    );
  }

  async createBranch(params: {
    docName: string;
    baseBranchId: string;
    newBranchName: string;
  }) {
    const { docName, baseBranchId, newBranchName } = params;

    const baseRootBlock = this.getRootBlock(docName, baseBranchId);
    if (!baseRootBlock) {
      throw new Error(
        `Cannot create branch ${newBranchName} from non-existing base branch ${baseBranchId} in document ${docName}`
      );
    }

    const baseBranchState = this.subscriptionSet.getBranchState(
      docName,
      baseBranchId
    );
    if (!baseBranchState) {
      throw new Error(
        `Cannot create branch ${newBranchName} from non-existing base branch ${baseBranchId} in document ${docName} on this client`
      );
    }
    const res = await updatesServiceClient.createBranch(
      {
        docName,
        name: newBranchName,
        baseBranchId: baseBranchState.branchId,
      },
      {
        timeoutMs: 10 * 1000,
      }
    );
    if (!res.branch) {
      throw new Error(
        `Failed to create branch ${newBranchName} from base branch ${baseBranchId} in document ${docName}`
      );
    }

    await this.peekRootBlock(docName, res.branch.branchId).ensureLoaded;

    const newRootBlock = this.getRootBlock(docName, res.branch.branchId);

    return {
      branch: res.branch,
      rootBlock: newRootBlock,
    };
  }

  private onUpdateV2 = (
    updates: Map<Y.NanoBlock, Uint8Array>,
    _origin: unknown,
    _store: Y.NanoStore,
    tr: Y.StoreTransaction
  ) => {
    // TODO: origin が自分のものかどうかを判断する
    if (!tr.local || updates.size === 0) {
      return;
    }

    // Disallow any updates under checkpoint roots (read-only snapshots)
    // TODO: This is supposed to be DEV only check.
    for (const block of updates.keys()) {
      const root = block.getRootBlock();
      const name = root?.name ?? "";
      if (isCheckpointDocName(name)) {
        throw new Error(
          `Local updates on checkpoint root are not allowed: ${name}`
        );
      }
    }

    const prevClientUpdateVersionSize = this.#clientUpdateVersions.size;
    const clientUpdateVersions: ClientUpdateVersions = new Map();
    updates.forEach((_, block) => {
      // clientUpdateVersion をインクリメント
      const version = increaseClientUpdateVersion(
        this.#clientUpdateVersions,
        block
      );
      clientUpdateVersions.set(block, version);
    });

    if (this.writeSendMode === "auto") {
      this._writeQueue.enqueue(updates, new Map(clientUpdateVersions));
    } else {
      // manual: accumulate pending updates per block and clientUpdateVersions
      for (const [block, update] of updates) {
        const arr = this._writePendingUpdates.get(block);
        if (arr) {
          arr.push(update);
        } else {
          this._writePendingUpdates.set(block, [update]);
        }
      }
      // keep the maximum version per block
      for (const [block, version] of clientUpdateVersions) {
        const current = this._writePendingClientUpdateVersions.get(block) ?? 0;
        if (version > current) {
          this._writePendingClientUpdateVersions.set(block, version);
        }
      }
    }

    if (
      prevClientUpdateVersionSize === 0 &&
      this.#clientUpdateVersions.size > 0
    ) {
      // debug("Got dirty.");
    }
  };

  private onDestroy = () => {
    this.destroyed = true;
  };

  private saveUpdates = async (
    allUpdates: Map<Y.NanoBlock, Uint8Array[]>,
    isSync: boolean,
    signal: AbortSignal
  ): Promise<SaveResult> => {
    if (allUpdates.size === 0) return { success: true };

    // rootBlock ごとに分けてリクエストする必要があるので、グループ化する
    const rootsUpdates = new Map<
      Y.NanoBlock | null,
      Map<Y.NanoBlock, Uint8Array[]>
    >();

    allUpdates.forEach((blocksUpdates, block) => {
      const root = block.getRootBlock();
      let rootUpdates = rootsUpdates.get(root);
      if (!rootUpdates) {
        rootUpdates = new Map();
        rootsUpdates.set(root, rootUpdates);
      }
      rootUpdates.set(block, blocksUpdates);
    });

    const promises: Array<Promise<BranchUpdateResult>> = [];
    rootsUpdates.forEach((blocksUpdates, rootBlock) => {
      if (!rootBlock) {
        return;
      }

      if (isSync) {
        // sync2 の場合は本当は複数の doc について一つのリクエストを送ることができる
        const { docName, branchId } = parseBranchDocName(rootBlock.name!);
        const req = create(Sync2RequestSchema, {
          updates: [
            {
              branch: strictCreate(BranchUpdatePayloadSchema, {
                docName,
                branchId,
                blocks: Array.from(blocksUpdates).map(([block, updates]) => {
                  return strictCreate(BlockUpdatePayloadSchema, {
                    blockId: block.id,
                    isRoot: block.isRoot,
                    blockType: yBlockTypeToPb(block.blockType),
                    updates,
                    guardUpdateVersion: 0, // sync2 では guardUpdateVersion は使わない
                  });
                }),
              }),
            },
          ],
        });
        const promise = updatesServiceClient
          .sync2(req, {
            signal,
            timeoutMs: 10 * 1000,
          })
          .then((res) => {
            return res.branches[0]!;
          });
        promises.push(promise);
      } else {
        const { docName, branchId } = parseBranchDocName(rootBlock.name!);
        const req = create(ApplyUpdatesRequestSchema, {
          branch: {
            docName,
            branchId,
            blocks: Array.from(blocksUpdates).map(([block, updates]) => {
              return create(BlockUpdatePayloadSchema, {
                blockId: block.id,
                isRoot: block.isRoot,
                blockType: yBlockTypeToPb(block.blockType),
                updates,
              });
            }),
          },
        });
        const promise = updatesServiceClient
          .applyUpdates(req, {
            signal,
            timeoutMs: 10 * 1000,
          })
          .then((res) => {
            return res.branch!;
          });
        promises.push(promise);
      }
    });

    const results = await Promise.allSettled(promises);
    const success = results.every(
      (result) => result.status === "fulfilled" && result.value.success
    );
    const successBlockIds = new Set<string>();
    const updateVersions = new Map<Y.NanoBlock, number>();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const docName = getBranchDocName({
        docName: result.value.docName,
        branchId: result.value.branchId,
      });
      const rootBlock = this.store.getRootBlock(docName);
      if (!rootBlock) continue;
      for (const b of result.value.blocks) {
        if (!b.success) continue;
        successBlockIds.add(b.blockId);
        const block = b.isRoot ? rootBlock : rootBlock.getBlock(b.blockId);
        if (!block) {
          debugError(`Block not found: ${b.blockId}`);
          continue;
        }
        updateVersions.set(block, b.updateVersion);
      }
    }
    return {
      success,
      successBlockIds,
      updateVersions,
    };
  };

  private onLoad = (branches: Branch[]) => {
    this.onData(branches);
  };

  private onData = (branches: Branch[]) => {
    const affectedRootBlocks = new Set<Y.NanoBlock>();
    Y.transactInStore(
      this.store,
      () => {
        for (const branch of branches) {
          const ydocName = getBranchDocName({
            docName: branch.docName,
            branchId: branch.branchId,
          });
          let rootBlock = this.store.getRootBlock(ydocName);
          if (!rootBlock) {
            const rootBlockData = branch.blocks.find((b) => b.isRoot);
            if (!rootBlockData) {
              continue;
            }
            rootBlock = this.store.getRootBlockOrCreate(
              ydocName,
              pbBlockTypeToY(rootBlockData.blockType)
            );
          }
          affectedRootBlocks.add(rootBlock);
          for (const blockData of branch.blocks) {
            let block = blockData.isRoot
              ? rootBlock
              : rootBlock.getBlock(blockData.blockId);
            if (!block) {
              block = rootBlock.getOrCreateBlock(
                blockData.blockId,
                pbBlockTypeToY(blockData.blockType)
              );
            }
            for (const update of blockData.updates) {
              const decoder = decoding.createDecoder(update);
              while (decoder.pos < decoder.arr.byteLength) {
                const decoded = decoding.readVarUint8Array(decoder);
                Y.applyUpdateV2(block, decoded);
              }
            }
            this.updateUpdateVersion(block, blockData.updateVersion);
          }
        }
      },
      null,
      false
    );
    // load の listener で変更が行われる可能性があるので、transaction の外側で emit する
    for (const rootBlock of affectedRootBlocks) {
      if (!rootBlock.isLoaded) {
        rootBlock.emit("load", []);
      }
    }
  };
  /**
   * リモートのデータを再取得して、ローカルの残っているデータを全て保存する
   * root block を選択して部分同期することはできず、全ての root block を同期する必要がある
   * root block ごとの部分同期を実現するためには、WriteQueue を root block ごとに分ける必要がありそう
   * TODO: Branch 対応
   */
  // async sync() {
  //   // まずはリモートのデータを取得する
  //   // subscriptionSet から今関心がある rootBlocks を取得
  //   const sync1Request = create(Sync1RequestSchema, {});

  //   for (const doc of this.subscriptionSet.getSubscribingDocuments()) {
  //     const blocks = this.getChildBlocks(doc.docName);
  //     sync1Request.docs.push(
  //       create(Sync1Request_DocPayloadSchema, {
  //         name: doc.docName,
  //         branchId: doc.branchId,
  //         blockUpdateVector: Object.fromEntries(
  //           blocks.map((block) => [block.id, this.getUpdateVersion(block)])
  //         ),
  //       })
  //     );
  //   }
  //   const sync1Result = await updatesServiceClient.sync1(sync1Request, {
  //     timeoutMs: 10 * 1000,
  //   });
  //   this.onLoad(sync1Result.docs);

  //   // sync2 を送って、未保存の block を全て保存する
  //   const updates = new Map<Y.NanoBlock, Uint8Array[]>();
  //   for (const [block, clientUpdateVersion] of this.#clientUpdateVersions) {
  //     if (clientUpdateVersion === 0) continue;
  //     const update = Y.encodeStateAsUpdateV2(block);
  //     updates.set(block, [update]);
  //   }
  //   this._writeQueue.enqueueSyncUpdates(
  //     updates,
  //     new Map(this.#clientUpdateVersions)
  //   );
  // }

  // private getChildBlocks(docName: string): Y.NanoBlock[] {
  //   const blocks: Y.NanoBlock[] = [];
  //   const seenBlocks = new Set<Y.NanoBlock>();
  //   // TODO: Fix after yjs upgrade - blocks property no longer exists on NanoStore
  //   // Need to find alternative way to iterate over all blocks
  //   // this.store.blocks.forEach((block) => {
  //   //   const root = block.getRootBlock();
  //   //   if (!root || seenBlocks.has(block)) return;
  //   //   seenBlocks.add(block);
  //   //   if (root.name === docName) {
  //   //     blocks.push(block);
  //   //   }
  //   // });

  //   // For now, just return the root block if it exists
  //   const rootBlock = this.store.getRootBlock(docName);
  //   if (rootBlock) {
  //     blocks.push(rootBlock);
  //   }
  //   return blocks;
  // }

  private updateUpdateVersion(block: Y.NanoBlock, version: number) {
    const updateVersion = this.#updateVersions.get(block);
    if (!updateVersion) {
      this.#updateVersions.set(block, new UpdateVersion(version));
    } else {
      updateVersion.update(version);
    }
  }

  /**
   * Load data for a document from the server
   */
  private async loadDocData(docName: string, branchId: string): Promise<void> {
    if (this.subscriptionSet.needsInitialLoad(docName, branchId)) {
      // Initial load: use getBranchDocByName
      const res = await updatesServiceClient.getBranch(
        {
          docName,
          branchId,
          includeBlocks: true,
          includeBlockUpdates: true,
        },
        {
          timeoutMs: 10 * 1000,
        }
      );
      if (res.branch) {
        this.onLoad([res.branch]);
        this.subscriptionSet.markLoaded(
          docName,
          branchId,
          res.branch.lastUpdateMessageId
        );
      }
    } else {
      throw new Error("Differential load not implemented yet");
      // Differential load: use sync1
      // branchState が存在しないならここには来ないはず
      // const branch = this.subscriptionSet.getBranchState(docName, branchName)!;
      // if (!branch.branchId) {
      //   // TODO: branchId が存在しない場合(未作成の branch) はどうしたらいいんだっけ？
      //   throw new Error(
      //     `Branch ${branchName} for document ${docName} does not have a branchId`
      //   );
      // }
      // const blocks = this.getChildBlocks(docName);
      // const sync1Request = create(Sync1RequestSchema, {
      //   docs: [
      //     create(Sync1Request_DocPayloadSchema, {
      //       name: docName,
      //       branchId: branch.branchId,
      //       blockUpdateVector: Object.fromEntries(
      //         blocks.map((block) => [block.id, this.getUpdateVersion(block)])
      //       ),
      //     }),
      //   ],
      // });
      // const result = await updatesServiceClient.sync1(sync1Request, {
      //   timeoutMs: 10 * 1000,
      // });
      // this.onLoad(result.docs);
      // if (result.docs[0]) {
      //   this.subscriptionSet.updateLastMessageId(
      //     docName,
      //     branchName,
      //     result.docs[0].lastUpdateMessageId
      //   );
      // }
    }
  }

  /**
   * Temporarily load a root block without subscribing to updates
   * @param docName Document name
   * @param type Block type
   * @param options Peek options including TTL
   */
  peekRootBlock(
    docName: string,
    branchId: string,
    options?: { ttl?: number }
  ): {
    ensureLoaded: Promise<void>;
  } {
    this.subscriptionSet.peek(docName, branchId, options);

    const ensureLoaded = this.loadDocData(docName, branchId);

    return { ensureLoaded };
  }

  /**
   * Subscribe to a root block for continuous updates
   * @param docName Document name
   * @param branchId Branch ID
   * @param options Subscribe options including grace period
   */
  subscribeRootBlock(
    docName: string,
    branchId: string,
    options?: { gracePeriod?: number }
  ): {
    unsubscribe: () => void;
    ensureLoaded: Promise<void>;
  } {
    const isSubscribing = this.subscriptionSet.isSubscribing(docName, branchId);
    const unsubscribe = this.subscriptionSet.subscribe(
      docName,
      branchId,
      options
    );

    const ensureLoaded = isSubscribing
      ? Promise.resolve()
      : this.loadDocData(docName, branchId);

    return { unsubscribe, ensureLoaded };
  }

  isLoaded(docName: string, branchId: string): boolean {
    return !this.subscriptionSet.needsInitialLoad(docName, branchId);
  }

  /**
   * Get active branches for a document
   * @param docName Document name
   * @returns Promise with active branches
   */
  async getActiveBranches(docName: string): Promise<GetActiveBranchesResponse> {
    const req = create(GetActiveBranchesRequestSchema, {
      docName,
    });
    const response = await updatesServiceClient.getActiveBranches(req, {
      timeoutMs: 10 * 1000,
    });
    return response;
  }

  /**
   * Fetch fork point checkpoint id between two branches (direct parent/child only)
   */
  async getForkPoint(params: {
    docName: string;
    branchIdA: string;
    branchIdB: string;
  }): Promise<GetForkPointResponse> {
    const req = create(GetForkPointRequestSchema, {
      docName: params.docName,
      branchIdA: params.branchIdA,
      branchIdB: params.branchIdB,
    });
    const response = await updatesServiceClient.getForkPoint(req, {
      timeoutMs: 10 * 1000,
    });
    return response;
  }

  /**
   * Fetch checkpoint metadata (includes snapshot_json)
   */
  async getCheckpoint(params: {
    docName: string;
    checkpointId: string;
  }): Promise<GetCheckpointResponse> {
    const req = create(GetCheckpointRequestSchema, {
      docName: params.docName,
      checkpointId: params.checkpointId,
    });
    const response = await updatesServiceClient.getCheckpoint(req, {
      timeoutMs: 10 * 1000,
    });
    return response;
  }

  /**
   * Create/read a read-only root block hydrated from a checkpoint.
   * - No WebSocket subscription, no writes are sent.
   * - Cached with TTL to avoid duplicate fetch/hydration.
   */
  async peekCheckpointRootBlock(params: {
    docName: string;
    checkpointId: string;
    ttl?: number; // default 60s
  }): Promise<Y.NanoBlock> {
    const { docName, checkpointId } = params;
    const ttl = params.ttl ?? 60_000;
    const key = getCheckpointCacheKey(docName, checkpointId);
    let state = this._checkpointStates.get(key);
    if (!state) {
      state = {
        docName,
        checkpointId,
        rootBlockName: getCheckpointDocName({ docName, checkpointId }),
        loaded: false,
      };
      this._checkpointStates.set(key, state);
    }
    const newExpiry = Date.now() + ttl;
    if (!state.expiresAt || state.expiresAt < newExpiry) {
      state.expiresAt = newExpiry;
    }

    if (!state.loaded) {
      if (!state.inflight) {
        state.inflight = this.hydrateCheckpoint(state).finally(() => {
          state.inflight = undefined;
          state.loaded = true;
        });
      }
      await state.inflight;
    } else {
      const existing = this.store.getRootBlock(state.rootBlockName);
      if (existing) return existing;
      // Unexpected: cached as loaded but missing in store; rehydrate
      await this.hydrateCheckpoint(state);
    }
    const rb = this.store.getRootBlock(state.rootBlockName);
    if (!rb) {
      throw new Error(
        `Checkpoint root block not found for ${state.docName}#${state.checkpointId}`
      );
    }
    return rb;
  }

  private async hydrateCheckpoint(state: {
    docName: string;
    checkpointId: string;
    rootBlockName: string;
  }): Promise<void> {
    const res = await this.getCheckpoint({
      docName: state.docName,
      checkpointId: state.checkpointId,
    });
    const cp = res.checkpoint;
    if (!cp) return;

    // Choose root block type if available
    const rootBlockData = cp.blocks.find((b) => b.isRoot);
    if (!rootBlockData) {
      throw new Error(
        `Checkpoint ${state.checkpointId} has no root block data`
      );
    }
    const rootType = pbBlockTypeToY(rootBlockData.blockType);
    const rootBlock = this.store.getRootBlockOrCreate(
      state.rootBlockName,
      rootType
    );

    const affectedBlocks = new Set<Y.NanoBlock>();
    Y.transactInStore(
      this.store,
      () => {
        for (const b of cp.blocks) {
          let block = b.isRoot ? rootBlock : rootBlock.getBlock(b.blockId);
          if (!block) {
            block = rootBlock.getOrCreateBlock(
              b.blockId,
              pbBlockTypeToY(b.blockType)
            );
          }
          affectedBlocks.add(block);
          for (const packed of b.updates) {
            const decoder = decoding.createDecoder(packed);
            while (decoder.pos < decoder.arr.byteLength) {
              const part = decoding.readVarUint8Array(decoder);
              Y.applyUpdateV2(block, part);
            }
          }
          this.updateUpdateVersion(block, b.updateVersion);
        }
      },
      null,
      false
    );

    // Emit load event for root if needed (mirrors onData behavior)
    if (!rootBlock.isLoaded) {
      rootBlock.emit("load", []);
    }
  }

  private collectCheckpointGarbage() {
    const now = Date.now();
    for (const [key, state] of this._checkpointStates) {
      if (state.expiresAt && state.expiresAt < now && !state.inflight) {
        this._checkpointStates.delete(key);
      }
    }
  }
}

// --- Helpers for namespacing ---
function getCheckpointCacheKey(docName: string, checkpointId: string) {
  return `${docName}:::${checkpointId}`;
}

function getCheckpointDocName(params: {
  docName: string;
  checkpointId: string;
}) {
  // Deliberately incompatible with branch doc naming (doc___branch)
  return `${params.docName}___cp___${params.checkpointId}`;
}

function isCheckpointDocName(name: string): boolean {
  return name.includes("___cp___");
}
