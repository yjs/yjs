/**
 * This is an abstract interface that all Connectors should implement to keep them interchangeable.
 *
 * @note This interface is experimental and it is not advised to actually inherit this class.
 *       It just serves as typing information.
 *
 * @extends {Observable<any>}
 */
export class AbstractConnector extends Observable<any> {
    /**
     * @param {Doc} ydoc
     * @param {any} awareness
     */
    constructor(ydoc: Doc, awareness: any);
    doc: Doc;
    awareness: any;
}
import { Observable } from "lib0/observable";
import { Doc } from "./Doc.js";
//# sourceMappingURL=AbstractConnector.d.ts.map