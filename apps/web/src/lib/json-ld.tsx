/**
 * One merged `@graph` per page, one `<script>` tag, entities cross-referenced
 * by `@id`. Plain typed objects rather than `schema-dts` — one dependency
 * fewer for a shape this small; revisit if the graph grows past a page's
 * worth of node types. See docs/02-architecture/seo.md.
 */

export type JsonLdNode = Record<string, unknown> & { '@type': string };

export function JsonLd({ graph }: { graph: JsonLdNode[] }): React.JSX.Element {
  const payload = { '@context': 'https://schema.org', '@graph': graph };
  return (
    <script
      type="application/ld+json"
      // Escaping `<` prevents a script-tag break-out. No user HTML reaches here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload).replace(/</g, '\\u003c') }}
    />
  );
}

export function breadcrumbList(items: { name: string; url: string }[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
