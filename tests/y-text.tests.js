import * as Y from './testHelper.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'

const { init, compare } = Y

/**
 * https://github.com/yjs/yjs/issues/474
 * @todo Remove debug: 127.0.0.1:8080/test.html?filter=\[88/
 * @param {t.TestCase} _tc
 */
export const testDeltaBug = _tc => {
  const initialDelta = [{
    attributes: {
      'block-id': 'block-28eea923-9cbb-4b6f-a950-cf7fd82bc087'
    },
    insert: '\n'
  },
  {
    attributes: {
      'table-col': {
        width: '150'
      }
    },
    insert: '\n\n\n'
  },
  {
    attributes: {
      'block-id': 'block-9144be72-e528-4f91-b0b2-82d20408e9ea',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-6kv2ls',
        cell: 'cell-apba4k'
      },
      row: 'row-6kv2ls',
      cell: 'cell-apba4k',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-639adacb-1516-43ed-b272-937c55669a1c',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-6kv2ls',
        cell: 'cell-a8qf0r'
      },
      row: 'row-6kv2ls',
      cell: 'cell-a8qf0r',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-6302ca4a-73a3-4c25-8c1e-b542f048f1c6',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-6kv2ls',
        cell: 'cell-oi9ikb'
      },
      row: 'row-6kv2ls',
      cell: 'cell-oi9ikb',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-ceeddd05-330e-4f86-8017-4a3a060c4627',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-d1sv2g',
        cell: 'cell-dt6ks2'
      },
      row: 'row-d1sv2g',
      cell: 'cell-dt6ks2',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-37b19322-cb57-4e6f-8fad-0d1401cae53f',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-d1sv2g',
        cell: 'cell-qah2ay'
      },
      row: 'row-d1sv2g',
      cell: 'cell-qah2ay',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-468a69b5-9332-450b-9107-381d593de249',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-d1sv2g',
        cell: 'cell-fpcz5a'
      },
      row: 'row-d1sv2g',
      cell: 'cell-fpcz5a',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-26b1d252-9b2e-4808-9b29-04e76696aa3c',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-pflz90',
        cell: 'cell-zrhylp'
      },
      row: 'row-pflz90',
      cell: 'cell-zrhylp',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-6af97ba7-8cf9-497a-9365-7075b938837b',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-pflz90',
        cell: 'cell-s1q9nt'
      },
      row: 'row-pflz90',
      cell: 'cell-s1q9nt',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-107e273e-86bc-44fd-b0d7-41ab55aca484',
      'table-cell-line': {
        rowspan: '1',
        colspan: '1',
        row: 'row-pflz90',
        cell: 'cell-20b0j9'
      },
      row: 'row-pflz90',
      cell: 'cell-20b0j9',
      rowspan: '1',
      colspan: '1'
    },
    insert: '\n'
  },
  {
    attributes: {
      'block-id': 'block-38161f9c-6f6d-44c5-b086-54cc6490f1e3'
    },
    insert: '\n'
  },
  {
    insert: 'Content after table'
  },
  {
    attributes: {
      'block-id': 'block-15630542-ef45-412d-9415-88f0052238ce'
    },
    insert: '\n'
  }
  ]
  const ydoc1 = new Y.Doc()
  const ytext = ydoc1.getText()
  ytext.applyDelta(initialDelta)
  const addingDash = [
    {
      retain: 12
    },
    {
      insert: '-'
    }
  ]
  ytext.applyDelta(addingDash)
  const addingSpace = [
    {
      retain: 13
    },
    {
      insert: ' '
    }
  ]
  ytext.applyDelta(addingSpace)
  const addingList = [
    {
      retain: 12
    },
    {
      delete: 2
    },
    {
      retain: 1,
      attributes: {
        // Clear table line attribute
        'table-cell-line': null,
        // Add list attribute in place of table-cell-line
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-20b0j9',
          list: 'bullet'
        }
      }
    }
  ]
  ytext.applyDelta(addingList)
  const result = ytext.toDelta()
  const expectedResult = [
    {
      attributes: {
        'block-id': 'block-28eea923-9cbb-4b6f-a950-cf7fd82bc087'
      },
      insert: '\n'
    },
    {
      attributes: {
        'table-col': {
          width: '150'
        }
      },
      insert: '\n\n\n'
    },
    {
      attributes: {
        'block-id': 'block-9144be72-e528-4f91-b0b2-82d20408e9ea',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-6kv2ls',
          cell: 'cell-apba4k'
        },
        row: 'row-6kv2ls',
        cell: 'cell-apba4k',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-639adacb-1516-43ed-b272-937c55669a1c',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-6kv2ls',
          cell: 'cell-a8qf0r'
        },
        row: 'row-6kv2ls',
        cell: 'cell-a8qf0r',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-6302ca4a-73a3-4c25-8c1e-b542f048f1c6',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-6kv2ls',
          cell: 'cell-oi9ikb'
        },
        row: 'row-6kv2ls',
        cell: 'cell-oi9ikb',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-ceeddd05-330e-4f86-8017-4a3a060c4627',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-d1sv2g',
          cell: 'cell-dt6ks2'
        },
        row: 'row-d1sv2g',
        cell: 'cell-dt6ks2',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-37b19322-cb57-4e6f-8fad-0d1401cae53f',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-d1sv2g',
          cell: 'cell-qah2ay'
        },
        row: 'row-d1sv2g',
        cell: 'cell-qah2ay',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-468a69b5-9332-450b-9107-381d593de249',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-d1sv2g',
          cell: 'cell-fpcz5a'
        },
        row: 'row-d1sv2g',
        cell: 'cell-fpcz5a',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-26b1d252-9b2e-4808-9b29-04e76696aa3c',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-zrhylp'
        },
        row: 'row-pflz90',
        cell: 'cell-zrhylp',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-6af97ba7-8cf9-497a-9365-7075b938837b',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-s1q9nt'
        },
        row: 'row-pflz90',
        cell: 'cell-s1q9nt',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      insert: '\n',
      // This attibutes has only list and no table-cell-line
      attributes: {
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-20b0j9',
          list: 'bullet'
        },
        'block-id': 'block-107e273e-86bc-44fd-b0d7-41ab55aca484',
        row: 'row-pflz90',
        cell: 'cell-20b0j9',
        rowspan: '1',
        colspan: '1'
      }
    },
    // No table-cell-line below here
    {
      attributes: {
        'block-id': 'block-38161f9c-6f6d-44c5-b086-54cc6490f1e3'
      },
      insert: '\n'
    },
    {
      insert: 'Content after table'
    },
    {
      attributes: {
        'block-id': 'block-15630542-ef45-412d-9415-88f0052238ce'
      },
      insert: '\n'
    }
  ]
  t.compare(result, expectedResult)
}

/**
 * https://github.com/yjs/yjs/issues/503
 * @param {t.TestCase} _tc
 */
export const testDeltaBug2 = _tc => {
  const initialContent = [
    { insert: "Thomas' section" },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-61ae80ac-a469-4eae-bac9-3b6a2c380118' }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-d265d93f-1cc7-40ee-bb58-8270fca2619f' }
    },
    { insert: '123' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-592a7bee-76a3-4e28-9c25-7a84344f8813',
        list: { list: 'toggled', 'toggle-id': 'list-66xfft' }
      }
    },
    { insert: '456' },
    {
      insert: '\n',
      attributes: {
        indent: 1,
        'block-id': 'block-3ee2bd70-b97f-45b2-9115-f1e8910235b1',
        list: { list: 'toggled', 'toggle-id': 'list-6vh0t0' }
      }
    },
    { insert: '789' },
    {
      insert: '\n',
      attributes: {
        indent: 1,
        'block-id': 'block-78150cf3-9bb5-4dea-a6f5-0ce1d2a98b9c',
        list: { list: 'toggled', 'toggle-id': 'list-7jr0l2' }
      }
    },
    { insert: '901' },
    {
      insert: '\n',
      attributes: {
        indent: 1,
        'block-id': 'block-13c6416f-f522-41d5-9fd4-ce4eb1cde5ba',
        list: { list: 'toggled', 'toggle-id': 'list-7uk8qu' }
      }
    },
    {
      insert: {
        slash_command: {
          id: 'doc_94zq-2436',
          sessionId: 'nkwc70p2j',
          replace: '/'
        }
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-8a1d2bb6-23c2-4bcf-af3c-3919ffea1697' }
    },
    { insert: '\n\n', attributes: { 'table-col': { width: '150' } } },
    {
      insert: '\n',
      attributes: { 'table-col': { width: '150' } }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-84ec3ea4-da6a-4e03-b430-0e5f432936a9',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-blmd4s',
          cell: 'cell-m0u5za'
        },
        row: 'row-blmd4s',
        cell: 'cell-m0u5za',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-83144ca8-aace-401e-8aa5-c05928a8ccf0',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-blmd4s',
          cell: 'cell-1v8s8t'
        },
        row: 'row-blmd4s',
        cell: 'cell-1v8s8t',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-9a493387-d27f-4b58-b2f7-731dfafda32a',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-blmd4s',
          cell: 'cell-126947'
        },
        row: 'row-blmd4s',
        cell: 'cell-126947',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-3484f86e-ae42-440f-8de6-857f0d8011ea',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-hmmljo',
          cell: 'cell-wvutl9'
        },
        row: 'row-hmmljo',
        cell: 'cell-wvutl9',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d4e0b741-9dea-47a5-85e1-4ded0efbc89d',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-hmmljo',
          cell: 'cell-nkablr'
        },
        row: 'row-hmmljo',
        cell: 'cell-nkablr',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-352f0d5a-d1b9-422f-b136-4bacefd00b1a',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-hmmljo',
          cell: 'cell-n8xtd0'
        },
        row: 'row-hmmljo',
        cell: 'cell-n8xtd0',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-95823e57-f29c-44cf-a69d-2b4494b7144b',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-ev4xwq',
          cell: 'cell-ua9bvu'
        },
        row: 'row-ev4xwq',
        cell: 'cell-ua9bvu',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-cde5c027-15d3-4780-9e76-1e1a9d97a8e8',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-ev4xwq',
          cell: 'cell-7bwuvk'
        },
        row: 'row-ev4xwq',
        cell: 'cell-7bwuvk',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-11a23ed4-b04d-4e45-8065-8120889cd4a4',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-ev4xwq',
          cell: 'cell-aouka5'
        },
        row: 'row-ev4xwq',
        cell: 'cell-aouka5',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-15b4483c-da98-4ded-91d3-c3d6ebc82582' }
    },
    { insert: { divider: true } },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-68552c8e-b57b-4f4a-9f36-6cc1ef6b3461' }
    },
    { insert: 'jklasjdf' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-c8b2df7d-8ec5-4dd4-81f1-8d8efc40b1b4',
        list: { list: 'toggled', 'toggle-id': 'list-9ss39s' }
      }
    },
    { insert: 'asdf' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-4f252ceb-14da-49ae-8cbd-69a701d18e2a',
        list: { list: 'toggled', 'toggle-id': 'list-uvo013' }
      }
    },
    { insert: 'adg' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-ccb9b72e-b94d-45a0-aae4-9b0a1961c533',
        list: { list: 'toggled', 'toggle-id': 'list-k53iwe' }
      }
    },
    { insert: 'asdfasdfasdf' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-ccb9b72e-b94d-45a0-aae4-9b0a1961c533',
        list: { list: 'none' },
        indent: 1
      }
    },
    { insert: 'asdf' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-f406f76d-f338-4261-abe7-5c9131f7f1ad',
        list: { list: 'toggled', 'toggle-id': 'list-en86ur' }
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-be18141c-9b6b-434e-8fd0-2c214437d560' }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-36922db3-4af5-48a1-9ea4-0788b3b5d7cf' }
    },
    { insert: { table_content: true } },
    { insert: ' ' },
    {
      insert: {
        slash_command: {
          id: 'doc_94zq-2436',
          sessionId: 'hiyrt6fny',
          replace: '/'
        }
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-9d6566a1-be55-4e20-999a-b990bc15e143' }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-4b545085-114d-4d07-844c-789710ec3aab',
        layout:
        '12d887e1-d1a2-4814-a1a3-0c904e950b46_1185cd29-ef1b-45d5-8fda-51a70b704e64',
        'layout-width': '0.25'
      }
    },
    {
      insert: '\n',
      attributes: {

        'block-id': 'block-4d3f2321-33d1-470e-9b7c-d5a683570148',
        layout:
        '12d887e1-d1a2-4814-a1a3-0c904e950b46_75523ea3-c67f-4f5f-a85f-ac7c8fc0a992',
        'layout-width': '0.5'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-4c7ae1e6-758e-470f-8d7c-ae0325e4ee8a',
        layout:
        '12d887e1-d1a2-4814-a1a3-0c904e950b46_54c740ef-fd7b-48c6-85aa-c14e1bfc9297',
        'layout-width': '0.25'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-2d6ff0f4-ff00-42b7-a8e2-b816463d8fb5' }
    },
    { insert: { divider: true } },
    {
      insert: '\n',
      attributes: { 'table-col': { width: '150' } }
    },
    { insert: '\n', attributes: { 'table-col': { width: '154' } } },
    {
      insert: '\n',
      attributes: { 'table-col': { width: '150' } }
    },

    {
      insert: '\n',
      attributes: {
        'block-id': 'block-38545d56-224b-464c-b779-51fcec24dbbf',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-q0qfck',
          cell: 'cell-hmapv4'
        },
        row: 'row-q0qfck',
        cell: 'cell-hmapv4',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d413a094-5f52-4fd4-a4aa-00774f6fdb44',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-q0qfck',
          cell: 'cell-c0czb2'
        },
        row: 'row-q0qfck',
        cell: 'cell-c0czb2',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-ff855cbc-8871-4e0a-9ba7-de0c1c2aa585',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-q0qfck',
          cell: 'cell-hcpqmm'
        },
        row: 'row-q0qfck',
        cell: 'cell-hcpqmm',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-4841e6ee-fef8-4473-bf04-f5ba62db17f0',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-etopyl',
          cell: 'cell-0io73v'
        },
        row: 'row-etopyl',
        cell: 'cell-0io73v',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-adeec631-d4fe-4f38-9d5e-e67ba068bd24',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-etopyl',
          cell: 'cell-gt2waa'
        },
        row: 'row-etopyl',
        cell: 'cell-gt2waa',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d38a7308-c858-4ce0-b1f3-0f9092384961',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-etopyl',
          cell: 'cell-os9ksy'
        },
        row: 'row-etopyl',
        cell: 'cell-os9ksy',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-a9df6568-1838-40d1-9d16-3c073b6ce169',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-hbx9ri'
        },
        row: 'row-0jwjg3',
        cell: 'cell-hbx9ri',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-e26a0cf2-fe62-44a5-a4ca-8678a56d62f1',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-yg5m2w'
        },
        row: 'row-0jwjg3',
        cell: 'cell-yg5m2w',
        rowspan: '1',
        colspan: '1'
      }
    },
    { insert: 'a' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-bfbc5ac2-7417-44b9-9aa5-8e36e4095627',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    { insert: 'b' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-f011c089-6389-47c0-8396-7477a29aa56f',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    { insert: 'c' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-4497788d-1e02-4fd5-a80a-48b61a6185cb',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    { insert: 'd' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-5d73a2c7-f98b-47c7-a3f5-0d8527962b02',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    { insert: 'e' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-bfda76ee-ffdd-45db-a22e-a6707e11cf68',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    { insert: 'd' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-35242e64-a69d-4cdb-bd85-2a93766bfab4',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    { insert: 'f' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-8baa22c8-491b-4f1b-9502-44179d5ae744',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2',
          list: 'ordered'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-0jwjg3',
        cell: 'cell-1azhl2'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-7fa64af0-6974-4205-8cee-529f8bd46852' }
    },
    { insert: { divider: true } },
    { insert: "Brandon's Section" },
    {
      insert: '\n',
      attributes: {
        header: 2,
        'block-id': 'block-cf49462c-2370-48ff-969d-576cb32c39a1'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-30ef8361-0dd6-4eee-b4eb-c9012d0e9070' }
    },
    {
      insert: {
        slash_command: {
          id: 'doc_94zq-2436',
          sessionId: 'x9x08o916',
          replace: '/'
        }
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-166ed856-cf8c-486a-9365-f499b21d91b3' }
    },
    { insert: { divider: true } },
    {
      insert: '\n',
      attributes: {
        row: 'row-kssn15',
        rowspan: '1',
        colspan: '1',
        'block-id': 'block-e8079594-4559-4259-98bb-da5280e2a692',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-kssn15',
          cell: 'cell-qxbksf'
        },
        cell: 'cell-qxbksf'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-70132663-14cc-4701-b5c5-eb99e875e2bd',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-kssn15',
          cell: 'cell-lsohbx'
        },
        cell: 'cell-lsohbx',
        row: 'row-kssn15',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-47a3899c-e3c5-4a7a-a8c4-46e0ae73a4fa',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-kssn15',
          cell: 'cell-hner9k'
        },
        cell: 'cell-hner9k',
        row: 'row-kssn15',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-0f9e650a-7841-412e-b4f2-5571b6d352c2',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-juxwc0',
          cell: 'cell-ei4yqp'
        },
        cell: 'cell-ei4yqp',
        row: 'row-juxwc0',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-53a158a9-8c82-4c82-9d4e-f5298257ca43',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-juxwc0',
          cell: 'cell-25pf5x'
        },
        cell: 'cell-25pf5x',
        row: 'row-juxwc0',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-da8ba35e-ce6e-4518-8605-c51d781eb07a',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-juxwc0',
          cell: 'cell-m8reor'
        },
        cell: 'cell-m8reor',
        row: 'row-juxwc0',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-2dce37c7-2978-4127-bed0-9549781babcb',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-ot4wy5',
          cell: 'cell-dinh0i'
        },
        cell: 'cell-dinh0i',
        row: 'row-ot4wy5',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-7b593f8c-4ea3-44b4-8ad9-4a0abffe759b',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-ot4wy5',
          cell: 'cell-d115b2'
        },
        cell: 'cell-d115b2',
        row: 'row-ot4wy5',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-272c28e6-2bde-4477-9d99-ce35b3045895',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-ot4wy5',
          cell: 'cell-fuapvo'
        },
        cell: 'cell-fuapvo',
        row: 'row-ot4wy5',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-fbf23cab-1ce9-4ede-9953-f2f8250004cf' }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-c3fbb8c9-495c-40b0-b0dd-f6e33dd64b1b' }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-3417ad09-92a3-4a43-b5db-6dbcb0f16db4' }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-b9eacdce-4ba3-4e66-8b69-3eace5656057' }
    },
    { insert: 'Dan Gornstein' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d7c6ae0d-a17c-433e-85fd-5efc52b587fb',
        header: 1
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-814521bd-0e14-4fbf-b332-799c6452a624' }
    },
    { insert: 'aaa' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-6aaf4dcf-dc21-45c6-b723-afb25fe0f498',
        list: { list: 'toggled', 'toggle-id': 'list-idl93b' }
      }
    },
    { insert: 'bb' },
    {
      insert: '\n',
      attributes: {
        indent: 1,
        'block-id': 'block-3dd75392-fa50-4bfb-ba6b-3b7d6bd3f1a1',
        list: { list: 'toggled', 'toggle-id': 'list-mrq7j2' }
      }
    },
    { insert: 'ccc' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-2528578b-ecda-4f74-9fd7-8741d72dc8b3',
        indent: 2,
        list: { list: 'toggled', 'toggle-id': 'list-liu7dl' }
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-18bf68c3-9ef3-4874-929c-9b6bb1a00325' }
    },
    {
      insert: '\n',
      attributes: { 'table-col': { width: '150' } }
    },
    { insert: '\n', attributes: { 'table-col': { width: '150' } } },
    {
      insert: '\n',
      attributes: { 'table-col': { width: '150' } }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d44e74b4-b37f-48e0-b319-6327a6295a57',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie'
        },
        row: 'row-si1nah',
        cell: 'cell-cpybie',
        rowspan: '1',
        colspan: '1'
      }
    },
    { insert: 'aaa' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-3e545ee9-0c9a-42d7-a4d0-833edb8087f3',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie',
          list: 'toggled',
          'toggle-id': 'list-kjl2ik'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-si1nah',
        cell: 'cell-cpybie'
      }
    },
    { insert: 'bb' },
    {
      insert: '\n',
      attributes: {
        indent: 1,
        'block-id': 'block-5f1225ad-370f-46ab-8f1e-18b277b5095f',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie',
          list: 'toggled',
          'toggle-id': 'list-eei1x5'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-si1nah',
        cell: 'cell-cpybie'
      }
    },
    { insert: 'ccc' },
    {
      insert: '\n',
      attributes: {
        indent: 2,
        'block-id': 'block-a77fdc11-ad24-431b-9ca2-09e32db94ac2',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie',
          list: 'toggled',
          'toggle-id': 'list-30us3c'
        },
        rowspan: '1',
        colspan: '1',
        row: 'row-si1nah',
        cell: 'cell-cpybie'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d44e74b4-b37f-48e0-b319-6327a6295a57',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie'
        },
        row: 'row-si1nah',
        cell: 'cell-cpybie',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-2c274c8a-757d-4892-8db8-1a7999f7ab51',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-al1z64'
        },
        row: 'row-si1nah',
        cell: 'cell-al1z64',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-85931afe-1879-471c-bb4b-89e7bd517fe9',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-q186pb'
        },
        row: 'row-si1nah',
        cell: 'cell-q186pb',
        rowspan: '1',
        colspan: '1'
      }
    },
    { insert: 'asdfasdfasdf' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-6e0522e8-c1eb-4c07-98df-2b07c533a139',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-7x2d1o',
          cell: 'cell-6eid2t'
        },
        row: 'row-7x2d1o',
        cell: 'cell-6eid2t',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-4b3d0bd0-9175-45e9-955c-e8164f4b5376',
        row: 'row-7x2d1o',
        cell: 'cell-m1alad',
        rowspan: '1',
        colspan: '1',
        list: {
          rowspan: '1',
          colspan: '1',
          row: 'row-7x2d1o',
          cell: 'cell-m1alad',
          list: 'ordered'
        }
      }
    },
    { insert: 'asdfasdfasdf' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-08610089-cb05-4366-bb1e-a0787d5b11bf',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-7x2d1o',
          cell: 'cell-dm1l2p'
        },
        row: 'row-7x2d1o',
        cell: 'cell-dm1l2p',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-c22b5125-8df3-432f-bd55-5ff456e41b4e',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-o0ujua',
          cell: 'cell-82g0ca'
        },
        row: 'row-o0ujua',
        cell: 'cell-82g0ca',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-7c6320e4-acaf-4ab4-8355-c9b00408c9c1',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-o0ujua',
          cell: 'cell-wv6ozp'
        },
        row: 'row-o0ujua',
        cell: 'cell-wv6ozp',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-d1bb7bed-e69e-4807-8d20-2d28fef8d08f',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-o0ujua',
          cell: 'cell-ldt53x'
        },
        row: 'row-o0ujua',
        cell: 'cell-ldt53x',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-28f28cb8-51a2-4156-acf9-2380e1349745' }
    },
    { insert: { divider: true } },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-a1193252-c0c8-47fe-b9f6-32c8b01a1619' }
    },
    { insert: '\n', attributes: { 'table-col': { width: '150' } } },
    {
      insert: '\n\n',
      attributes: { 'table-col': { width: '150' } }
    },
    { insert: '/This is a test.' },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-14188df0-a63f-4317-9a6d-91b96a7ac9fe',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-5ixdvv',
          cell: 'cell-9tgyed'
        },
        row: 'row-5ixdvv',
        cell: 'cell-9tgyed',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-7e5ba2af-9903-457d-adf4-2a79be81d823',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-5ixdvv',
          cell: 'cell-xc56e9'
        },
        row: 'row-5ixdvv',
        cell: 'cell-xc56e9',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-eb6cad93-caf7-4848-8adf-415255139268',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-5ixdvv',
          cell: 'cell-xrze3u'
        },
        row: 'row-5ixdvv',
        cell: 'cell-xrze3u',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-5bb547a2-6f71-4624-80c7-d0e1318c81a2',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-xbzv98',
          cell: 'cell-lie0ng'
        },
        row: 'row-xbzv98',
        cell: 'cell-lie0ng',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-b506de0d-efb6-4bd7-ba8e-2186cc57903e',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-xbzv98',
          cell: 'cell-s9sow1'
        },
        row: 'row-xbzv98',
        cell: 'cell-s9sow1',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-42d2ad20-5521-40e3-a88d-fe6906176e61',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-xbzv98',
          cell: 'cell-nodtcj'
        },
        row: 'row-xbzv98',
        cell: 'cell-nodtcj',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-7d3e4216-3f68-4dd6-bc77-4a9fad4ba008',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-5bqfil',
          cell: 'cell-c8c0f3'
        },
        row: 'row-5bqfil',
        cell: 'cell-c8c0f3',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-6671f221-551e-47fb-9b7d-9043b6b12cdc',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-5bqfil',
          cell: 'cell-jvxxif'
        },
        row: 'row-5bqfil',
        cell: 'cell-jvxxif',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: {
        'block-id': 'block-51e3161b-0437-4fe3-ac4f-129a93a93fc3',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-5bqfil',
          cell: 'cell-rmjpze'
        },
        row: 'row-5bqfil',
        cell: 'cell-rmjpze',
        rowspan: '1',
        colspan: '1'
      }
    },
    {
      insert: '\n',
      attributes: { 'block-id': 'block-21099df0-afb2-4cd3-834d-bb37800eb06a' }
    }
  ]
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText('id')
  ytext.applyDelta(initialContent)
  const changeEvent = [
    { retain: 90 },
    { delete: 4 },
    {
      retain: 1,
      attributes: {
        layout: null,
        'layout-width': null,
        'block-id': 'block-9d6566a1-be55-4e20-999a-b990bc15e143'
      }
    }
  ]
  ytext.applyDelta(changeEvent)
  const delta = ytext.toDelta()
  t.compare(delta[41], {
    insert: '\n',
    attributes: {
      'block-id': 'block-9d6566a1-be55-4e20-999a-b990bc15e143'
    }
  })
}

/**
 * In this test we are mainly interested in the cleanup behavior and whether the resulting delta makes sense.
 * It is fine if the resulting delta is not minimal. But applying the delta to a rich-text editor should result in a
 * synced document.
 *
 * @param {t.TestCase} tc
 */
export const testDeltaAfterConcurrentFormatting = tc => {
  const { text0, text1, testConnector } = init(tc, { users: 2 })
  text0.insert(0, 'abcde')
  testConnector.flushAllMessages()
  text0.format(0, 3, { bold: true })
  text1.format(2, 2, { bold: true })
  /**
   * @type {any}
   */
  const deltas = []
  text1.observe(event => {
    if (event.delta.length > 0) {
      deltas.push(event.delta)
    }
  })
  testConnector.flushAllMessages()
  t.compare(deltas, [[{ retain: 3, attributes: { bold: true } }, { retain: 2, attributes: { bold: null } }]])
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicInsertAndDelete = tc => {
  const { users, text0 } = init(tc, { users: 2 })
  let delta

  text0.observe(event => {
    delta = event.delta
  })

  text0.delete(0, 0)
  t.assert(true, 'Does not throw when deleting zero elements with position 0')

  text0.insert(0, 'abc')
  t.assert(text0.toString() === 'abc', 'Basic insert works')
  t.compare(delta, [{ insert: 'abc' }])

  text0.delete(0, 1)
  t.assert(text0.toString() === 'bc', 'Basic delete works (position 0)')
  t.compare(delta, [{ delete: 1 }])

  text0.delete(1, 1)
  t.assert(text0.toString() === 'b', 'Basic delete works (position 1)')
  t.compare(delta, [{ retain: 1 }, { delete: 1 }])

  users[0].transact(() => {
    text0.insert(0, '1')
    text0.delete(0, 1)
  })
  t.compare(delta, [])

  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicFormat = tc => {
  const { users, text0 } = init(tc, { users: 2 })
  let delta
  text0.observe(event => {
    delta = event.delta
  })
  text0.insert(0, 'abc', { bold: true })
  t.assert(text0.toString() === 'abc', 'Basic insert with attributes works')
  t.compare(text0.toDelta(), [{ insert: 'abc', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'abc', attributes: { bold: true } }])
  text0.delete(0, 1)
  t.assert(text0.toString() === 'bc', 'Basic delete on formatted works (position 0)')
  t.compare(text0.toDelta(), [{ insert: 'bc', attributes: { bold: true } }])
  t.compare(delta, [{ delete: 1 }])
  text0.delete(1, 1)
  t.assert(text0.toString() === 'b', 'Basic delete works (position 1)')
  t.compare(text0.toDelta(), [{ insert: 'b', attributes: { bold: true } }])
  t.compare(delta, [{ retain: 1 }, { delete: 1 }])
  text0.insert(0, 'z', { bold: true })
  t.assert(text0.toString() === 'zb')
  t.compare(text0.toDelta(), [{ insert: 'zb', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'z', attributes: { bold: true } }])
  // @ts-ignore
  t.assert(text0._start.right.right.right.content.str === 'b', 'Does not insert duplicate attribute marker')
  text0.insert(0, 'y')
  t.assert(text0.toString() === 'yzb')
  t.compare(text0.toDelta(), [{ insert: 'y' }, { insert: 'zb', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'y' }])
  text0.format(0, 2, { bold: null })
  t.assert(text0.toString() === 'yzb')
  t.compare(text0.toDelta(), [{ insert: 'yz' }, { insert: 'b', attributes: { bold: true } }])
  t.compare(delta, [{ retain: 1 }, { retain: 1, attributes: { bold: null } }])
  compare(users)
}

/**
 * @param {t.TestCase} _tc
 */
export const testMultilineFormat = _tc => {
  const ydoc = new Y.Doc()
  const testText = ydoc.getText('test')
  testText.insert(0, 'Test\nMulti-line\nFormatting')
  testText.applyDelta([
    { retain: 4, attributes: { bold: true } },
    { retain: 1 }, // newline character
    { retain: 10, attributes: { bold: true } },
    { retain: 1 }, // newline character
    { retain: 10, attributes: { bold: true } }
  ])
  t.compare(testText.toDelta(), [
    { insert: 'Test', attributes: { bold: true } },
    { insert: '\n' },
    { insert: 'Multi-line', attributes: { bold: true } },
    { insert: '\n' },
    { insert: 'Formatting', attributes: { bold: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testNotMergeEmptyLinesFormat = _tc => {
  const ydoc = new Y.Doc()
  const testText = ydoc.getText('test')
  testText.applyDelta([
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } },
    { insert: '\nText' },
    { insert: '\n', attributes: { title: true } }
  ])
  t.compare(testText.toDelta(), [
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } },
    { insert: '\nText' },
    { insert: '\n', attributes: { title: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testPreserveAttributesThroughDelete = _tc => {
  const ydoc = new Y.Doc()
  const testText = ydoc.getText('test')
  testText.applyDelta([
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } },
    { insert: '\n' }
  ])
  testText.applyDelta([
    { retain: 4 },
    { delete: 1 },
    { retain: 1, attributes: { title: true } }
  ])
  t.compare(testText.toDelta(), [
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } }
  ])
}

/**
 * @param {t.TestCase} tc
 */
export const testGetDeltaWithEmbeds = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.applyDelta([{
    insert: { linebreak: 's' }
  }])
  t.compare(text0.toDelta(), [{
    insert: { linebreak: 's' }
  }])
}

/**
 * @param {t.TestCase} tc
 */
export const testTypesAsEmbed = tc => {
  const { text0, text1, testConnector } = init(tc, { users: 2 })
  text0.applyDelta([{
    insert: new Y.Map([['key', 'val']])
  }])
  t.compare(text0.toDelta()[0].insert.toJSON(), { key: 'val' })
  let firedEvent = false
  text1.observe(event => {
    const d = event.delta
    t.assert(d.length === 1)
    t.compare(d.map(x => /** @type {Y.AbstractType<any>} */ (x.insert).toJSON()), [{ key: 'val' }])
    firedEvent = true
  })
  testConnector.flushAllMessages()
  const delta = text1.toDelta()
  t.assert(delta.length === 1)
  t.compare(delta[0].insert.toJSON(), { key: 'val' })
  t.assert(firedEvent, 'fired the event observer containing a Type-Embed')
}

/**
 * @param {t.TestCase} tc
 */
export const testSnapshot = tc => {
  const { text0 } = init(tc, { users: 1 })
  const doc0 = /** @type {Y.Doc} */ (text0.doc)
  doc0.gc = false
  text0.applyDelta([{
    insert: 'abcd'
  }])
  const snapshot1 = Y.snapshot(doc0)
  text0.applyDelta([{
    retain: 1
  }, {
    insert: 'x'
  }, {
    delete: 1
  }])
  const snapshot2 = Y.snapshot(doc0)
  text0.applyDelta([{
    retain: 2
  }, {
    delete: 3
  }, {
    insert: 'x'
  }, {
    delete: 1
  }])
  const state1 = text0.toDelta(snapshot1)
  t.compare(state1, [{ insert: 'abcd' }])
  const state2 = text0.toDelta(snapshot2)
  t.compare(state2, [{ insert: 'axcd' }])
  const state2Diff = text0.toDelta(snapshot2, snapshot1)
  // @ts-ignore Remove userid info
  state2Diff.forEach(v => {
    if (v.attributes && v.attributes.ychange) {
      delete v.attributes.ychange.user
    }
  })
  t.compare(state2Diff, [{ insert: 'a' }, { insert: 'x', attributes: { ychange: { type: 'added' } } }, { insert: 'b', attributes: { ychange: { type: 'removed' } } }, { insert: 'cd' }])
}

/**
 * @param {t.TestCase} tc
 */
export const testSnapshotDeleteAfter = tc => {
  const { text0 } = init(tc, { users: 1 })
  const doc0 = /** @type {Y.Doc} */ (text0.doc)
  doc0.gc = false
  text0.applyDelta([{
    insert: 'abcd'
  }])
  const snapshot1 = Y.snapshot(doc0)
  text0.applyDelta([{
    retain: 4
  }, {
    insert: 'e'
  }])
  const state1 = text0.toDelta(snapshot1)
  t.compare(state1, [{ insert: 'abcd' }])
}

/**
 * @param {t.TestCase} tc
 */
export const testToJson = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'abc', { bold: true })
  t.assert(text0.toJSON() === 'abc', 'toJSON returns the unformatted text')
}

/**
 * @param {t.TestCase} tc
 */
export const testToDeltaEmbedAttributes = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'ab', { bold: true })
  text0.insertEmbed(1, { image: 'imageSrc.png' }, { width: 100 })
  const delta0 = text0.toDelta()
  t.compare(delta0, [{ insert: 'a', attributes: { bold: true } }, { insert: { image: 'imageSrc.png' }, attributes: { width: 100 } }, { insert: 'b', attributes: { bold: true } }])
}

/**
 * @param {t.TestCase} tc
 */
export const testToDeltaEmbedNoAttributes = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'ab', { bold: true })
  text0.insertEmbed(1, { image: 'imageSrc.png' })
  const delta0 = text0.toDelta()
  t.compare(delta0, [{ insert: 'a', attributes: { bold: true } }, { insert: { image: 'imageSrc.png' } }, { insert: 'b', attributes: { bold: true } }], 'toDelta does not set attributes key when no attributes are present')
}

/**
 * @param {t.TestCase} tc
 */
export const testFormattingRemoved = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'ab', { bold: true })
  text0.delete(0, 2)
  t.assert(Y.getTypeChildren(text0).length === 1)
}

/**
 * @param {t.TestCase} tc
 */
export const testFormattingRemovedInMidText = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, '1234')
  text0.insert(2, 'ab', { bold: true })
  text0.delete(2, 2)
  t.assert(Y.getTypeChildren(text0).length === 3)
}

/**
 * Reported in https://github.com/yjs/yjs/issues/344
 *
 * @param {t.TestCase} tc
 */
export const testFormattingDeltaUnnecessaryAttributeChange = tc => {
  const { text0, text1, testConnector } = init(tc, { users: 2 })
  text0.insert(0, '\n', {
    PARAGRAPH_STYLES: 'normal',
    LIST_STYLES: 'bullet'
  })
  text0.insert(1, 'abc', {
    PARAGRAPH_STYLES: 'normal'
  })
  testConnector.flushAllMessages()
  /**
   * @type {Array<any>}
   */
  const deltas = []
  text0.observe(event => {
    deltas.push(event.delta)
  })
  text1.observe(event => {
    deltas.push(event.delta)
  })
  text1.format(0, 1, { LIST_STYLES: 'number' })
  testConnector.flushAllMessages()
  const filteredDeltas = deltas.filter(d => d.length > 0)
  t.assert(filteredDeltas.length === 2)
  t.compare(filteredDeltas[0], [
    { retain: 1, attributes: { LIST_STYLES: 'number' } }
  ])
  t.compare(filteredDeltas[0], filteredDeltas[1])
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertAndDeleteAtRandomPositions = tc => {
  const N = 100000
  const { text0 } = init(tc, { users: 1 })
  const gen = tc.prng

  // create initial content
  // let expectedResult = init
  text0.insert(0, prng.word(gen, N / 2, N / 2))

  // apply changes
  for (let i = 0; i < N; i++) {
    const pos = prng.uint32(gen, 0, text0.length)
    if (prng.bool(gen)) {
      const len = prng.uint32(gen, 1, 5)
      const word = prng.word(gen, 0, len)
      text0.insert(pos, word)
      // expectedResult = expectedResult.slice(0, pos) + word + expectedResult.slice(pos)
    } else {
      const len = prng.uint32(gen, 0, math.min(3, text0.length - pos))
      text0.delete(pos, len)
      // expectedResult = expectedResult.slice(0, pos) + expectedResult.slice(pos + len)
    }
  }
  // t.compareStrings(text0.toString(), expectedResult)
  t.describe('final length', '' + text0.length)
}

/**
 * @param {t.TestCase} tc
 */
export const testAppendChars = tc => {
  const N = 10000
  const { text0 } = init(tc, { users: 1 })

  // apply changes
  for (let i = 0; i < N; i++) {
    text0.insert(text0.length, 'a')
  }
  t.assert(text0.length === N)
}

const largeDocumentSize = 100000

const id = Y.createID(0, 0)
const c = new Y.ContentString('a')

/**
 * @param {t.TestCase} _tc
 */
export const testBestCase = _tc => {
  const N = largeDocumentSize
  const items = new Array(N)
  t.measureTime('time to create two million items in the best case', () => {
    const parent = /** @type {any} */ ({})
    let prevItem = null
    for (let i = 0; i < N; i++) {
      /**
       * @type {Y.Item}
       */
      const n = new Y.Item(Y.createID(0, 0), null, null, null, null, null, null, c)
      // items.push(n)
      items[i] = n
      n.right = prevItem
      n.rightOrigin = prevItem ? id : null
      n.content = c
      n.parent = parent
      prevItem = n
    }
  })
  const newArray = new Array(N)
  t.measureTime('time to copy two million items to new Array', () => {
    for (let i = 0; i < N; i++) {
      newArray[i] = items[i]
    }
  })
}

const tryGc = () => {
  // @ts-ignore
  if (typeof global !== 'undefined' && global.gc) {
    // @ts-ignore
    global.gc()
  }
}

/**
 * @param {t.TestCase} _tc
 */
export const testLargeFragmentedDocument = _tc => {
  const itemsToInsert = largeDocumentSize
  let update = /** @type {any} */ (null)
  ;(() => {
    const doc1 = new Y.Doc()
    const text0 = doc1.getText('txt')
    tryGc()
    t.measureTime(`time to insert ${itemsToInsert} items`, () => {
      doc1.transact(() => {
        for (let i = 0; i < itemsToInsert; i++) {
          text0.insert(0, '0')
        }
      })
    })
    tryGc()
    t.measureTime('time to encode document', () => {
      update = Y.encodeStateAsUpdateV2(doc1)
    })
    t.describe('Document size:', update.byteLength)
  })()
  ;(() => {
    const doc2 = new Y.Doc()
    tryGc()
    t.measureTime(`time to apply ${itemsToInsert} updates`, () => {
      Y.applyUpdateV2(doc2, update)
    })
  })()
}

/**
 * @param {t.TestCase} _tc
 */
export const testIncrementalUpdatesPerformanceOnLargeFragmentedDocument = _tc => {
  const itemsToInsert = largeDocumentSize
  const updates = /** @type {Array<Uint8Array>} */ ([])
  ;(() => {
    const doc1 = new Y.Doc()
    doc1.on('update', update => {
      updates.push(update)
    })
    const text0 = doc1.getText('txt')
    tryGc()
    t.measureTime(`time to insert ${itemsToInsert} items`, () => {
      doc1.transact(() => {
        for (let i = 0; i < itemsToInsert; i++) {
          text0.insert(0, '0')
        }
      })
    })
    tryGc()
  })()
  ;(() => {
    t.measureTime(`time to merge ${itemsToInsert} updates (differential updates)`, () => {
      Y.mergeUpdates(updates)
    })
    tryGc()
    t.measureTime(`time to merge ${itemsToInsert} updates (ydoc updates)`, () => {
      const ydoc = new Y.Doc()
      updates.forEach(update => {
        Y.applyUpdate(ydoc, update)
      })
    })
  })()
}

/**
 * Splitting surrogates can lead to invalid encoded documents.
 *
 * https://github.com/yjs/yjs/issues/248
 *
 * @param {t.TestCase} tc
 */
export const testSplitSurrogateCharacter = tc => {
  {
    const { users, text0 } = init(tc, { users: 2 })
    users[1].disconnect() // disconnecting forces the user to encode the split surrogate
    text0.insert(0, '👾') // insert surrogate character
    // split surrogate, which should not lead to an encoding error
    text0.insert(1, 'hi!')
    compare(users)
  }
  {
    const { users, text0 } = init(tc, { users: 2 })
    users[1].disconnect() // disconnecting forces the user to encode the split surrogate
    text0.insert(0, '👾👾') // insert surrogate character
    // partially delete surrogate
    text0.delete(1, 2)
    compare(users)
  }
  {
    const { users, text0 } = init(tc, { users: 2 })
    users[1].disconnect() // disconnecting forces the user to encode the split surrogate
    text0.insert(0, '👾👾') // insert surrogate character
    // formatting will also split surrogates
    text0.format(1, 2, { bold: true })
    compare(users)
  }
}

/**
 * Search marker bug https://github.com/yjs/yjs/issues/307
 *
 * @param {t.TestCase} tc
 */
export const testSearchMarkerBug1 = tc => {
  const { users, text0, text1, testConnector } = init(tc, { users: 2 })

  users[0].on('update', update => {
    users[0].transact(() => {
      Y.applyUpdate(users[0], update)
    })
  })
  users[0].on('update', update => {
    users[1].transact(() => {
      Y.applyUpdate(users[1], update)
    })
  })

  text0.insert(0, 'a_a')
  testConnector.flushAllMessages()
  text0.insert(2, 's')
  testConnector.flushAllMessages()
  text1.insert(3, 'd')
  testConnector.flushAllMessages()
  text0.delete(0, 5)
  testConnector.flushAllMessages()
  text0.insert(0, 'a_a')
  testConnector.flushAllMessages()
  text0.insert(2, 's')
  testConnector.flushAllMessages()
  text1.insert(3, 'd')
  testConnector.flushAllMessages()
  t.compareStrings(text0.toString(), text1.toString())
  t.compareStrings(text0.toString(), 'a_sda')
  compare(users)
}

/**
 * Reported in https://github.com/yjs/yjs/pull/32
 *
 * @param {t.TestCase} _tc
 */
export const testFormattingBug = async _tc => {
  const ydoc1 = new Y.Doc()
  const ydoc2 = new Y.Doc()
  const text1 = ydoc1.getText()
  text1.insert(0, '\n\n\n')
  text1.format(0, 3, { url: 'http://example.com' })
  ydoc1.getText().format(1, 1, { url: 'http://docs.yjs.dev' })
  ydoc2.getText().format(1, 1, { url: 'http://docs.yjs.dev' })
  Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1))
  const text2 = ydoc2.getText()
  const expectedResult = [
    { insert: '\n', attributes: { url: 'http://example.com' } },
    { insert: '\n', attributes: { url: 'http://docs.yjs.dev' } },
    { insert: '\n', attributes: { url: 'http://example.com' } }
  ]
  t.compare(text1.toDelta(), expectedResult)
  t.compare(text1.toDelta(), text2.toDelta())
  console.log(text1.toDelta())
}

/**
 * Delete formatting should not leave redundant formatting items.
 *
 * @param {t.TestCase} _tc
 */
export const testDeleteFormatting = _tc => {
  const doc = new Y.Doc()
  const text = doc.getText()
  text.insert(0, 'Attack ships on fire off the shoulder of Orion.')

  const doc2 = new Y.Doc()
  const text2 = doc2.getText()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  text.format(13, 7, { bold: true })
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  text.format(16, 4, { bold: null })
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  const expected = [
    { insert: 'Attack ships ' },
    { insert: 'on ', attributes: { bold: true } },
    { insert: 'fire off the shoulder of Orion.' }
  ]
  t.compare(text.toDelta(), expected)
  t.compare(text2.toDelta(), expected)
}

// RANDOM TESTS

let charCounter = 0

/**
 * Random tests for pure text operations without formatting.
 *
 * @type Array<function(any,prng.PRNG):void>
 */
const textChanges = [
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert text
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.length)
    const text = charCounter++ + prng.word(gen)
    const prevText = ytext.toString()
    ytext.insert(insertPos, text)
    t.compareStrings(ytext.toString(), prevText.slice(0, insertPos) + text + prevText.slice(insertPos))
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // delete text
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    const prevText = ytext.toString()
    ytext.delete(insertPos, overwrite)
    t.compareStrings(ytext.toString(), prevText.slice(0, insertPos) + prevText.slice(insertPos + overwrite))
  }
]

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges5 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 5))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges30 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 30))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges40 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 40))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges50 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 50))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges70 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 70))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges90 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 90))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges300 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 300))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

const marks = [
  { bold: true },
  { italic: true },
  { italic: true, color: '#888' }
]

const marksChoices = [
  undefined,
  ...marks
]

/**
 * Random tests for all features of y-text (formatting, embeds, ..).
 *
 * @type Array<function(any,prng.PRNG):void>
 */
const qChanges = [
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert text
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.length)
    const attrs = prng.oneOf(gen, marksChoices)
    const text = charCounter++ + prng.word(gen)
    ytext.insert(insertPos, text, attrs)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert embed
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.length)
    if (prng.bool(gen)) {
      ytext.insertEmbed(insertPos, { image: 'https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png' })
    } else {
      ytext.insertEmbed(insertPos, new Y.Map([[prng.word(gen), prng.word(gen)]]))
    }
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // delete text
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    ytext.delete(insertPos, overwrite)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // format text
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    const format = prng.oneOf(gen, marks)
    ytext.format(insertPos, overwrite, format)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert codeblock
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.toString().length)
    const text = charCounter++ + prng.word(gen)
    const ops = []
    if (insertPos > 0) {
      ops.push({ retain: insertPos })
    }
    ops.push({ insert: text }, { insert: '\n', format: { 'code-block': true } })
    ytext.applyDelta(ops)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // complex delta op
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    let currentPos = math.max(0, prng.int32(gen, 0, contentLen - 1))
    /**
     * @type {Array<any>}
     */
    const ops = currentPos > 0 ? [{ retain: currentPos }] : []
    // create max 3 ops
    for (let i = 0; i < 7 && currentPos < contentLen; i++) {
      prng.oneOf(gen, [
        () => { // format
          const retain = math.min(prng.int32(gen, 0, contentLen - currentPos), 5)
          const format = prng.oneOf(gen, marks)
          ops.push({ retain, attributes: format })
          currentPos += retain
        },
        () => { // insert
          const attrs = prng.oneOf(gen, marksChoices)
          const text = prng.word(gen, 1, 3)
          ops.push({ insert: text, attributes: attrs })
        },
        () => { // delete
          const delLen = math.min(prng.int32(gen, 0, contentLen - currentPos), 10)
          ops.push({ delete: delLen })
          currentPos += delLen
        }
      ])()
    }
    ytext.applyDelta(ops)
  }
]

/**
 * @param {any} result
 */
const checkResult = result => {
  for (let i = 1; i < result.testObjects.length; i++) {
    /**
     * @param {any} d
     */
    const typeToObject = d => d.insert instanceof Y.AbstractType ? d.insert.toJSON() : d
    const p1 = result.users[i].getText('text').toDelta().map(typeToObject)
    const p2 = result.users[i].getText('text').toDelta().map(typeToObject)
    t.compare(p1, p2)
  }
  // Uncomment this to find formatting-cleanup issues
  // const cleanups = Y.cleanupYTextFormatting(result.users[0].getText('text'))
  // t.assert(cleanups === 0)
  return result
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges1 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, qChanges, 1))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges2 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, qChanges, 2))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges2Repeat = tc => {
  for (let i = 0; i < 1000; i++) {
    const { users } = checkResult(Y.applyRandomTests(tc, qChanges, 2))
    const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
    t.assert(cleanups === 0)
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges3 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 3))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges30 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 30))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges40 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 40))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges70 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 70))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges100 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 100))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges300 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 300))
}
