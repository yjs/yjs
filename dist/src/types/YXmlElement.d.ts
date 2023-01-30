/**
 * An YXmlElement imitates the behavior of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}.
 *
 * * An YXmlElement has attributes (key value pairs)
 * * An YXmlElement has childElements that must inherit from YXmlElement
 */
export class YXmlElement extends YXmlFragment {
    constructor(nodeName?: string);
    nodeName: string;
    /**
     * @type {Map<string, any>|null}
     */
    _prelimAttrs: Map<string, any> | null;
    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get nextSibling(): YXmlElement | YXmlText | null;
    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get prevSibling(): YXmlElement | YXmlText | null;
    /**
     * Creates an Item with the same effect as this Item (without position effect)
     *
     * @return {YXmlElement}
     */
    _copy(): YXmlElement;
    /**
     * @return {YXmlElement}
     */
    clone(): YXmlElement;
    /**
     * Removes an attribute from this YXmlElement.
     *
     * @param {String} attributeName The attribute name that is to be removed.
     *
     * @public
     */
    public removeAttribute(attributeName: string): void;
    /**
     * Sets or updates an attribute.
     *
     * @param {String} attributeName The attribute name that is to be set.
     * @param {String} attributeValue The attribute value that is to be set.
     *
     * @public
     */
    public setAttribute(attributeName: string, attributeValue: string): void;
    /**
     * Returns an attribute value that belongs to the attribute name.
     *
     * @param {String} attributeName The attribute name that identifies the
     *                               queried value.
     * @return {String} The queried attribute value.
     *
     * @public
     */
    public getAttribute(attributeName: string): string;
    /**
     * Returns whether an attribute exists
     *
     * @param {String} attributeName The attribute name to check for existence.
     * @return {boolean} whether the attribute exists.
     *
     * @public
     */
    public hasAttribute(attributeName: string): boolean;
    /**
     * Returns all attribute name/value pairs in a JSON Object.
     *
     * @return {Object<string, any>} A JSON Object that describes the attributes.
     *
     * @public
     */
    public getAttributes(): {
        [x: string]: any;
    };
}
export function readYXmlElement(decoder: UpdateDecoderV1 | UpdateDecoderV2): YXmlElement;
import { YXmlFragment } from "./YXmlFragment.js";
import { YXmlText } from "./YXmlText.js";
import { UpdateDecoderV1 } from "../utils/UpdateDecoder.js";
import { UpdateDecoderV2 } from "../utils/UpdateDecoder.js";
