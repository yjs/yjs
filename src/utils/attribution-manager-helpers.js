import * as s from 'lib0/schema'
import * as error from 'lib0/error'
import { ObservableV2 } from 'lib0/observable'

export const attributionJsonSchema = s.$object({
  insert: s.$array(s.$string).optional,
  insertedAt: s.$number.optional,
  delete: s.$array(s.$string).optional,
  deletedAt: s.$number.optional,
  format: s.$record(s.$string, s.$array(s.$string)).optional,
  formatAt: s.$number.optional
})

/**
 * @todo rename this to `insertBy`, `insertAt`, ..
 *
 * @typedef {s.Unwrap<typeof attributionJsonSchema>} Attribution
 */

/**
 * @template T
 */
export class AttributedContent {
  /**
   * @param {AbstractContent} content
   * @param {number} clock
   * @param {boolean} deleted
   * @param {Array<ContentAttribute<T>> | null} attrs
   * @param {0|1|2} renderBehavior
   */
  constructor (content, clock, deleted, attrs, renderBehavior) {
    this.content = content
    this.clock = clock
    this.deleted = deleted
    this.attrs = attrs
    this.render = renderBehavior === 0 ? false : (renderBehavior === 1 ? (!deleted || attrs != null) : true)
  }
}

/**
 * Abstract class for associating Attributions to content / changes
 *
 * Should fire an event when the attributions changed _after_ the original change happens. This
 * Event will be used to update the attribution on the current content.
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class AbstractAttributionManager extends ObservableV2 {
  /**
   * @param {Array<AttributedContent<any>>} _contents - where to write the result
   * @param {number} _client
   * @param {number} _clock
   * @param {boolean} _deleted
   * @param {AbstractContent} _content
   * @param {0|1|2} _shouldRender - 0: if undeleted or attributed, render as a retain operation. 1: render only if undeleted or attributed. 2: render as insert operation (if unattributed and deleted, render as delete).
   */
  readContent (_contents, _client, _clock, _deleted, _content, _shouldRender) {
    error.methodUnimplemented()
  }

  /**
   * Calculate the length of the attributed content. This is used by iterators that walk through the
   * content.
   *
   * If the content is not countable, it should return 0.
   *
   * @param {Item} _item
   * @return {number}
   */
  contentLength (_item) {
    error.methodUnimplemented()
  }
}

export const $attributionManager = AbstractAttributionManager.prototype.$type = s.$type('y:am', AbstractAttributionManager)

/**
 * Abstract class for associating Attributions to content / changes
 *
 * @implements AbstractAttributionManager
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class NoAttributionsManager extends ObservableV2 {
  get $type () { return $attributionManager }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} _client
   * @param {number} clock
   * @param {boolean} deleted
   * @param {AbstractContent} content
   * @param {0|1|2} shouldRender - whether this should render or just result in a `retain` operation
   */
  readContent (contents, _client, clock, deleted, content, shouldRender) {
    if (!deleted || shouldRender) {
      contents.push(new AttributedContent(content, clock, deleted, null, shouldRender))
    }
  }

  /**
   * @param {Item} item
   * @return {number}
   */
  contentLength (item) {
    return (item.deleted || !item.content.isCountable()) ? 0 : item.length
  }
}

export const noAttributionsManager = new NoAttributionsManager()
