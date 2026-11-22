/**
 * The community gallery (PRD Phase 5, "community-made buyers and scenarios"). GitHub Pages has no
 * server, so the gallery is a curated list shipped with the game: players submit a scenario code
 * through a prefilled GitHub issue, and the maintainer adds it here after review (moderation by
 * pull request). Every code is decoded and sanitised again at runtime, like any shared code.
 */
export interface GalleryEntry {
  title: string;
  author: string;
  code: string;
}

export const GALLERY: GalleryEntry[] = [
  { title: 'Monsoon Madness', author: 'SewingFactoryMania', code: 'SFM1-WyJNb25zb29uIE1hZG5lc3MiLDIsNSwxODAwLCIxOTkwcyIsWyJoYW5pbCIsImZvcm1vc2EiLCJnb2xkZW4iXSxbXSxbImJyZWFrZG93bnMiXSwibW9uc29vbiIsODExXQsp' },
  { title: 'Christmas in the Zone', author: 'SewingFactoryMania', code: 'SFM1-WyJDaHJpc3RtYXMgaW4gdGhlIFpvbmUiLDQsNywzNTAwLCIxOTkwcyIsWyJub3JkbGljaHQiLCJzYWt1cmF5YSIsImhhbmlsIiwia2Fuc2FpIl0sW10sW10sImNocmlzdG1hcyIsMTIyNF04x' },
  { title: 'Yukata Masters', author: 'SewingFactoryMania', code: 'SFM1-WyJZdWthdGEgTWFzdGVycyIsMiw1LDIwMDAsIjE5OTBzIixbInNha3VyYXlhIiwia2Fuc2FpIl0sW10sWyJsZWFybmluZyJdLCJub25lIiw3N10p0' },
  { title: 'Hello, America', author: 'SewingFactoryMania', code: 'SFM1-WyJIZWxsbywgQW1lcmljYSIsMyw3LDMwMDAsIjIwMDciLFsiYXRsYW50aWMiLCJub3JkbGljaHQiLCJmb3Jtb3NhIl0sW10sW10sIm5vbmUiLDIwMDdd85' },
  { title: 'Night Market', author: 'SewingFactoryMania', code: 'SFM1-WyJOaWdodCBNYXJrZXQiLDEsMyw5MDAsIjE5OTBzIixbInNhaWdvbiJdLFtbIkNo4bujIMSQw6ptIFRyYWRlcnMiLCJCw6AgTsSDbSIsIkPhuqduIFRoxqEiLCJub25lIiwiUGF5cyBpbiBnb2xkLCBoYWdnbGVzIGZvcmV2ZXIuIiwic2hvcnRzIl1dLFtdLCJub25lIiwzXQb4' },
  { title: 'Lanterns for Every Child', author: 'SewingFactoryMania', code: 'SFM1-WyJMYW50ZXJucyBmb3IgRXZlcnkgQ2hpbGQiLDIsMCwyMjAwLCIxOTkwcyIsWyJmb3Jtb3NhIiwicGVhcmwiLCJzYWlnb24iXSxbXSxbXSwibWlkYXV0dW1uIiw5MTVd34' },
];

export const SUBMIT_URL = 'https://github.com/alma92350/SewingFactoryMania/issues/new';

/** A prefilled "new issue" link for submitting a scenario to the gallery. */
export function submitLink(name: string, code: string): string {
  const title = `Gallery submission: ${name}`;
  const body = `Scenario code:\n\n\`\`\`\n${code}\n\`\`\`\n\nWhat makes it fun:\n\n(Write a sentence or two. Please do not include personal information.)`;
  return `${SUBMIT_URL}?labels=gallery&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
