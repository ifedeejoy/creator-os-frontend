const PROHIBITED_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'alter',
  'drop',
  'create',
  'replace',
  'truncate',
  'grant',
  'revoke',
  'comment',
  'copy',
  'attach',
  'vacuum',
];

const USER_SCOPED_TABLES = ['videos', 'daily_metrics'];

function containsProhibitedKeyword(query: string) {
  const lower = query.toLowerCase();
  return PROHIBITED_KEYWORDS.some(keyword => lower.includes(`${keyword} `) || lower.includes(`${keyword}\n`));
}

function referencesUserScopedTable(query: string) {
  const lower = query.toLowerCase();
  return USER_SCOPED_TABLES.some(table => lower.includes(`${table} `) || lower.includes(`${table}\n`) || lower.includes(`${table}.`));
}

export function prepareReadOnlyQuery(rawQuery: string, userId: string) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) {
    throw new Error('Query must not be empty');
  }

  const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, '');

  if (!/^select\s/i.test(withoutTrailingSemicolon)) {
    throw new Error('Only SELECT statements are allowed');
  }

  if (containsProhibitedKeyword(withoutTrailingSemicolon)) {
    throw new Error('Only read-only queries are permitted');
  }

  if ((withoutTrailingSemicolon.match(/select/gi) || []).length > 1 && withoutTrailingSemicolon.includes(') select')) {
    throw new Error('Nested SELECT statements are not allowed');
  }

  const requiresUserScope = referencesUserScopedTable(withoutTrailingSemicolon);

  if (requiresUserScope && !/{{\s*user_id\s*}}/i.test(withoutTrailingSemicolon)) {
    throw new Error('Queries touching user-scoped tables must include {{user_id}} placeholder');
  }

  let prepared = withoutTrailingSemicolon;

  if (requiresUserScope) {
    prepared = prepared.replace(/{{\s*user_id\s*}}/gi, `'${userId}'`);
  }

  if (!/\blimit\s+\d+/i.test(prepared)) {
    prepared = `${prepared} LIMIT 100`;
  }

  return prepared;
}
