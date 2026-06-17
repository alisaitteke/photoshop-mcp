import { nextTick, onMounted, watch, type Ref } from 'vue';

interface UseTextareaAutosizeOptions {
  minLines?: number;
  maxLines?: number;
  watch?: Ref<string>;
}

function parsePx(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function lineHeightPx(el: HTMLTextAreaElement): number {
  const style = getComputedStyle(el);
  const parsed = parsePx(style.lineHeight);
  if (parsed > 0) return parsed;
  const fontSize = parsePx(style.fontSize);
  return fontSize > 0 ? fontSize * 1.5 : 20;
}

export function useTextareaAutosize(
  textareaRef: Ref<HTMLTextAreaElement | null>,
  options: UseTextareaAutosizeOptions = {}
): { onInput: () => void; resize: () => void } {
  const minLines = options.minLines ?? 3;
  const maxLines = options.maxLines ?? 50;

  function resize(): void {
    const el = textareaRef.value;
    if (!el) return;

    const lineHeight = lineHeightPx(el);
    const style = getComputedStyle(el);
    const padding =
      parsePx(style.paddingTop) +
      parsePx(style.paddingBottom) +
      parsePx(style.borderTopWidth) +
      parsePx(style.borderBottomWidth);

    const minHeight = lineHeight * minLines + padding;
    const maxHeight = lineHeight * maxLines + padding;

    el.style.height = '0px';
    const contentHeight = el.scrollHeight;
    const nextHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);

    el.style.height = `${nextHeight}px`;
    el.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }

  function onInput(): void {
    resize();
  }

  onMounted(() => {
    void nextTick(resize);
  });

  if (options.watch) {
    watch(options.watch, () => {
      void nextTick(resize);
    });
  }

  return { onInput, resize };
}
