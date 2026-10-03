/// Ref callbacks for inputs that appear in response to a click (inline rename
/// fields, recorders). The `autofocus` attribute is only reliable at page
/// load, so these focus the element when it mounts.
export function focusOnMount(el: HTMLElement | null) {
  el?.focus();
}

export function selectOnMount(el: HTMLInputElement | null) {
  el?.focus();
  el?.select();
}
