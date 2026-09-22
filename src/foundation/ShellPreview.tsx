import { useState } from "react";
import { IosMessagesApp } from "@/components/imessage/ios-messages-app";
import { MacMessagesApp } from "@/components/imessage/macos-messages-app";
import { foundationConversations, foundationDraft, foundationMessages, foundationNow, foundationSend } from "@/foundation/fixture";

export function ShellPreview({ platform, theme }: { platform: "ios" | "macos"; theme: "light" | "dark" }) {
  const [draft, setDraft] = useState(foundationDraft);
  const composer = { value: draft, onChange: setDraft, onSend: foundationSend };
  return (
    <div className={theme === "dark" ? "dark" : undefined} data-foundation={platform} data-theme={theme}>
      {platform === "ios" ? (
        <IosMessagesApp
          time="9:41"
          screen="conversation"
          contact={{ name: "Alex Morgan", initials: "AM" }}
          messages={foundationMessages}
          now={foundationNow}
          composer={composer}
        />
      ) : (
        <MacMessagesApp
          active
          contact={{ name: "Alex Morgan", initials: "AM" }}
          conversations={foundationConversations}
          selectedId="alex"
          messages={foundationMessages}
          now={foundationNow}
          composer={composer}
        />
      )}
    </div>
  );
}
