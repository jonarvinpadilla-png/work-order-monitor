// Optional real photos. Put a file named after the screen in src/photos/
// (signin, signup, reset or requester, as .jpg/.jpeg/.png/.webp) and it
// replaces that screen's illustration on the next build.
const files = import.meta.glob('../photos/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });

export function photoFor(key) {
  const hit = Object.entries(files).find(([path]) => path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase() === key);
  return hit ? hit[1] : null;
}
