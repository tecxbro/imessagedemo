import { forwardRef } from "react";
import { notImplemented, type CatalogueSceneProps, type RendererHandle, type RendererProps } from "@/contracts";

export const IosDemoRenderer = forwardRef<RendererHandle, RendererProps>(function IosDemoRenderer() {
  return notImplemented("IosDemoRenderer");
});

export function IosCatalogueScene(_props: CatalogueSceneProps): never {
  return notImplemented("IosCatalogueScene");
}
