/**
 * @extends YEvent<YXmlElement|YXmlText|YXmlFragment>
 * An Event that describes changes on a YXml Element or Yxml Fragment
 */
export class YXmlEvent extends YEvent<YXmlFragment | YXmlElement<{
    [key: string]: string;
}> | YXmlText> {
    /**
     * @param {YXmlElement|YXmlText|YXmlFragment} target The target on which the event is created.
     * @param {Set<string|null>} subs The set of changed attributes. `null` is included if the
     *                   child list changed.
     * @param {Transaction} transaction The transaction instance with wich the
     *                                  change was created.
     */
    constructor(target: YXmlElement | YXmlText | YXmlFragment, subs: Set<string | null>, transaction: Transaction);
    /**
     * Whether the children changed.
     * @type {Boolean}
     * @private
     */
    private childListChanged;
    /**
     * Set of all changed attributes.
     * @type {Set<string>}
     */
    attributesChanged: Set<string>;
}
import { YXmlFragment } from "./YXmlFragment.js";
import { YXmlElement } from "./YXmlElement.js";
import { YXmlText } from "./YXmlText.js";
import { YEvent } from "../utils/YEvent.js";
import { Transaction } from "../utils/Transaction.js";
//# sourceMappingURL=YXmlEvent.d.ts.map