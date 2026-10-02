import { inject, type InjectionKey, type Ref } from 'vue';

/** The chat whose preview images are being shown; provided by ChatView. */
export const PREVIEW_CHAT_ID: InjectionKey<Ref<string | null>> = Symbol('preview-chat-id');

export function usePreviewChatId(): Ref<string | null> | undefined {
  return inject(PREVIEW_CHAT_ID, undefined);
}
