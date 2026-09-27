import { BadRequestException } from '@nestjs/common';
import { runListQuery } from './list-engine';
import { ListSpec } from './list-spec';

interface Row {
  id: string;
  name: string;
  status: 'OPEN' | 'DONE';
  tags: string[];
  groups: { id: string; name: string }[];
  archived: boolean;
  score: number | null;
}

const rows: Row[] = [
  {
    id: '1',
    name: 'Alpha',
    status: 'OPEN',
    tags: ['U12'],
    groups: [{ id: 'g1', name: 'Cup' }],
    archived: false,
    score: 3,
  },
  {
    id: '2',
    name: 'beta',
    status: 'DONE',
    tags: ['U12', 'U14'],
    groups: [],
    archived: false,
    score: null,
  },
  {
    id: '3',
    name: 'Gamma',
    status: 'OPEN',
    tags: ['U14'],
    groups: [
      { id: 'g1', name: 'Cup' },
      { id: 'g2', name: 'Youth' },
    ],
    archived: true,
    score: 1,
  },
];

const spec: ListSpec<Row> = {
  search: (r) => [r.name],
  filters: [
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      options: [
        { value: 'OPEN', label: 'Open' },
        { value: 'DONE', label: 'Done' },
        { value: 'LATER', label: 'Later' },
      ],
      values: (r) => [r.status],
    },
    {
      key: 'tag',
      label: 'Tag',
      type: 'tag',
      values: (r) => r.tags.map((t) => ({ value: t, label: t })),
    },
    {
      key: 'group',
      label: 'Group',
      type: 'ref',
      values: (r) => r.groups.map((g) => ({ value: g.id, label: g.name })),
    },
    {
      key: 'archived',
      label: 'Archived',
      type: 'boolean',
      values: (r) => [r.archived],
    },
  ],
  sorts: { name: (r) => r.name, score: (r) => r.score },
  defaultSort: 'name',
  defaultFilters: { archived: ['false'] },
};

const run = (query: Record<string, unknown>) =>
  runListQuery(rows, spec, { page: 1, limit: 25, ...query });

describe('runListQuery', () => {
  it('applies default filters and sort (case-insensitive)', () => {
    const res = run({});
    expect(res.items.map((r) => r.id)).toEqual(['1', '2']);
    expect(res.meta).toMatchObject({
      total: 2,
      page: 1,
      limit: 25,
      sort: 'name',
      filters: { archived: ['false'] },
    });
  });

  it('overrides defaults when the filter is given explicitly', () => {
    expect(run({ filter: { archived: 'true,false' } }).items).toHaveLength(3);
  });

  it('ORs values within a filter and ANDs across filters', () => {
    const res = run({
      filter: { archived: ['true', 'false'], tag: 'U12,U14', status: 'OPEN' },
    });
    expect(res.items.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('filters many-valued refs', () => {
    expect(
      run({ filter: { archived: 'true,false', group: 'g2' } }).items.map(
        (r) => r.id,
      ),
    ).toEqual(['3']);
  });

  it('searches case-insensitively', () => {
    expect(run({ search: 'ALP' }).items.map((r) => r.id)).toEqual(['1']);
  });

  it('sorts descending with nulls last and paginates', () => {
    const res = run({
      filter: { archived: 'true,false' },
      sort: '-score',
      limit: 2,
      page: 1,
    });
    expect(res.items.map((r) => r.id)).toEqual(['1', '3']);
    const page2 = run({
      filter: { archived: 'true,false' },
      sort: '-score',
      limit: 2,
      page: 2,
    });
    expect(page2.items.map((r) => r.id)).toEqual(['2']);
    expect(page2.meta.total).toBe(3);
  });

  it('computes facets with all other filters applied, listing all enum options', () => {
    const res = run({ filter: { status: 'OPEN' } });
    const status = res.meta.facets.find((f) => f.key === 'status')!;
    // status facet ignores its own filter: open 1 + done 1 among non-archived
    expect(status.options).toEqual([
      { value: 'OPEN', label: 'Open', count: 1 },
      { value: 'DONE', label: 'Done', count: 1 },
      { value: 'LATER', label: 'Later', count: 0 },
    ]);
    const tag = res.meta.facets.find((f) => f.key === 'tag')!;
    expect(tag.options).toEqual([{ value: 'U12', label: 'U12', count: 1 }]);
    const archived = res.meta.facets.find((f) => f.key === 'archived')!;
    expect(archived.options).toEqual([
      { value: 'false', label: 'No', count: 1 },
      { value: 'true', label: 'Yes', count: 1 },
    ]);
  });

  it('keeps selected values in facets even when they have no matches', () => {
    const res = run({ filter: { group: 'missing' } });
    expect(
      res.meta.facets.find((f) => f.key === 'group')!.options,
    ).toContainEqual({
      value: 'missing',
      label: 'missing',
      count: 0,
    });
  });

  it('rejects unknown filter and sort keys', () => {
    expect(() => run({ filter: { nope: 'x' } })).toThrow(BadRequestException);
    expect(() => run({ sort: 'nope' })).toThrow(/Allowed: name, score/);
  });

  it('rejects non-boolean values for boolean filters', () => {
    expect(() => run({ filter: { archived: 'maybe' } })).toThrow(
      /true or false/,
    );
  });
});
