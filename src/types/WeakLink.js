
/**
 * @template T
 * 
 * Weak link to another value stored somewhere in the document.
 */
export class WeakLink {
    
    /**
     * Returns a reference to an underlying value existing somewhere on in the document.
     * 
     * @return {T|undefined}
     */
    deref() {
        throw new Error('not implemented')
    }
}