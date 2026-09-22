import type { CatalogueSceneDefinition, DemoTheme } from "@/contracts";
import catalogueJson from "@/contracts/catalogue-scenes.json";
import { IosCatalogueScene } from "@/renderers/ios";
import { MacCatalogueScene } from "@/renderers/macos";

function scene(id: string): CatalogueSceneDefinition {
  const found = catalogueJson.scenes.find((item) => item.id === id);
  if (!found) throw new Error(`Missing catalogue scene ${id}`);
  return found as CatalogueSceneDefinition;
}

const iosText = scene("ios-text");
const macosText = scene("macos-text");
const link = scene("link");
const image = scene("image");
const audio = scene("audio");
const attachment = scene("attachment");
const typing = scene("typing");
const tapback = scene("tapback");
const bubbleEffect = scene("bubble-effect");
const screenEffect = scene("screen-effect");
const facetime = scene("facetime");
const system = scene("system");
const imageViewer = scene("image-viewer");
const effectsPicker = scene("effects-picker");

export const catalogueSceneIds = [
  "ios-text",
  "macos-text",
  "link",
  "image",
  "audio",
  "attachment",
  "typing",
  "tapback",
  "bubble-effect",
  "screen-effect",
  "facetime",
  "system",
  "image-viewer",
  "effects-picker",
] as const;

export type CatalogueSceneId = (typeof catalogueSceneIds)[number];

export function isCatalogueSceneId(id: string): id is CatalogueSceneId {
  return (catalogueSceneIds as readonly string[]).includes(id);
}

export function CatalogueRoute({ theme }: { theme: DemoTheme }) {
  return (
    <div data-player-catalogue="">
      <IosCatalogueScene scene={iosText} theme={theme} />
      <MacCatalogueScene scene={macosText} theme={theme} />
      <IosCatalogueScene scene={link} theme={theme} />
      <MacCatalogueScene scene={link} theme={theme} />
      <IosCatalogueScene scene={image} theme={theme} />
      <MacCatalogueScene scene={image} theme={theme} />
      <IosCatalogueScene scene={audio} theme={theme} />
      <MacCatalogueScene scene={audio} theme={theme} />
      <IosCatalogueScene scene={attachment} theme={theme} />
      <MacCatalogueScene scene={attachment} theme={theme} />
      <IosCatalogueScene scene={typing} theme={theme} />
      <MacCatalogueScene scene={typing} theme={theme} />
      <IosCatalogueScene scene={tapback} theme={theme} />
      <MacCatalogueScene scene={tapback} theme={theme} />
      <IosCatalogueScene scene={bubbleEffect} theme={theme} />
      <MacCatalogueScene scene={bubbleEffect} theme={theme} />
      <IosCatalogueScene scene={screenEffect} theme={theme} />
      <MacCatalogueScene scene={screenEffect} theme={theme} />
      <IosCatalogueScene scene={facetime} theme={theme} />
      <MacCatalogueScene scene={facetime} theme={theme} />
      <IosCatalogueScene scene={system} theme={theme} />
      <MacCatalogueScene scene={system} theme={theme} />
      <IosCatalogueScene scene={imageViewer} theme={theme} />
      <MacCatalogueScene scene={imageViewer} theme={theme} />
      <IosCatalogueScene scene={effectsPicker} theme={theme} />
    </div>
  );
}

export function CatalogueSceneById({ id, theme }: { id: string; theme: DemoTheme }) {
  switch (id) {
    case "ios-text":
      return <IosCatalogueScene scene={iosText} theme={theme} />;
    case "macos-text":
      return <MacCatalogueScene scene={macosText} theme={theme} />;
    case "link":
      return (
        <>
          <IosCatalogueScene scene={link} theme={theme} />
          <MacCatalogueScene scene={link} theme={theme} />
        </>
      );
    case "image":
      return (
        <>
          <IosCatalogueScene scene={image} theme={theme} />
          <MacCatalogueScene scene={image} theme={theme} />
        </>
      );
    case "audio":
      return (
        <>
          <IosCatalogueScene scene={audio} theme={theme} />
          <MacCatalogueScene scene={audio} theme={theme} />
        </>
      );
    case "attachment":
      return (
        <>
          <IosCatalogueScene scene={attachment} theme={theme} />
          <MacCatalogueScene scene={attachment} theme={theme} />
        </>
      );
    case "typing":
      return (
        <>
          <IosCatalogueScene scene={typing} theme={theme} />
          <MacCatalogueScene scene={typing} theme={theme} />
        </>
      );
    case "tapback":
      return (
        <>
          <IosCatalogueScene scene={tapback} theme={theme} />
          <MacCatalogueScene scene={tapback} theme={theme} />
        </>
      );
    case "bubble-effect":
      return (
        <>
          <IosCatalogueScene scene={bubbleEffect} theme={theme} />
          <MacCatalogueScene scene={bubbleEffect} theme={theme} />
        </>
      );
    case "screen-effect":
      return (
        <>
          <IosCatalogueScene scene={screenEffect} theme={theme} />
          <MacCatalogueScene scene={screenEffect} theme={theme} />
        </>
      );
    case "facetime":
      return (
        <>
          <IosCatalogueScene scene={facetime} theme={theme} />
          <MacCatalogueScene scene={facetime} theme={theme} />
        </>
      );
    case "system":
      return (
        <>
          <IosCatalogueScene scene={system} theme={theme} />
          <MacCatalogueScene scene={system} theme={theme} />
        </>
      );
    case "image-viewer":
      return (
        <>
          <IosCatalogueScene scene={imageViewer} theme={theme} />
          <MacCatalogueScene scene={imageViewer} theme={theme} />
        </>
      );
    case "effects-picker":
      return <IosCatalogueScene scene={effectsPicker} theme={theme} />;
    default:
      return <p data-catalogue-unknown="">Unknown catalogue scene.</p>;
  }
}
