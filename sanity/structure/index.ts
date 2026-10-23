import { CogIcon } from "@sanity/icons/Cog";
import { DocumentIcon } from "@sanity/icons/Document";
import { InfoOutlineIcon } from "@sanity/icons/InfoOutline";
import { ProjectsIcon } from "@sanity/icons/Projects";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import type { StructureBuilder, StructureResolver } from "sanity/structure";
import type { ComponentType } from "react";

function documentTypeSingletonItem(
  S: StructureBuilder,
  title: string,
  icon: ComponentType,
  schemaType: string,
  schemaId: string,
) {
  return S.listItem()
    .title(title)
    .icon(icon)
    .child(S.document().schemaType(schemaType).documentId(schemaId));
}

export const structure: StructureResolver = (S: StructureBuilder, context) =>
  S.list()
    .title("Website Content")
    .items([
      documentTypeSingletonItem(S, "Home", DocumentIcon, "home", "home"),
      documentTypeSingletonItem(S, "About", InfoOutlineIcon, "about", "about"),

      S.divider(),
      orderableDocumentListDeskItem({
        type: "work",
        title: "Work",
        icon: ProjectsIcon,
        S,
        context,
      }),

      S.divider(),
      documentTypeSingletonItem(S, "Settings", CogIcon, "settings", "settings"),
    ]);
