
export const writeStructToTransaction = (transaction, struct) => {
  transaction.encodedStructsLen++
  struct._toBinary(transaction.encodedStructs)
}
