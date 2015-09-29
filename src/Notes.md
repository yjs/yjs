
# Notes

### Terminology

* DB: DataBase that holds all the information of the shared object. It is devided into the OS, DS, and SS. This can be a persistent database or an in-memory database. Depending on the type of database, it could make sense to store OS, DS, and SS in different tables, or maybe different databases.
* OS: OperationStore holds all the operations. An operation is a js object with a fixed number of name fields.
* DS: DeleteStore holds the information about which operations are deleted and which operations were garbage collected (no longer available in the OS).
* SS: StateSet holds the current state of the OS. SS.getState(username) refers to the amount of operations that were received by that respective user.
* Op: Operation defines an action on a shared type. But it is also the format in which we store the model of a type. This is why it is also called a Struct/Structure.
* Type and Structure: We crearly distinguish between type and structure. Short explanation: A type (e.g. Strings, Numbers) have a number of functions that you can apply on them. (+) is well defined on both of them. They are *modeled* by a structure - the functions really change the structure of a type. Types can be implemented differently but still provide the same functionality. In Yjs, almost all types are realized as a doubly linked list (on which Yjs can provide eventual convergence)
*