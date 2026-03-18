import docsJson from "../../../docs.json";

type DocsJson = {
  groups: Array<{
    id: string;
    title: string;
    items: Array<{
      id: string;
      title: string;
      slug?: string;
    }>;
  }>;
};

export const navGroups = (docsJson as DocsJson).groups.map((group) => ({
  id: group.id,
  title: group.title,
  items: group.items.map((item) => ({
    title: item.title,
    href: item.slug ?? `/docs/${item.id}`,
  })),
}));
