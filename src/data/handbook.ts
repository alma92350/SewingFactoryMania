/** Mentor tips (Bác Tư) and the Handbook glossary (PRD Appendix A). Tips fire at teaching moments. */

export interface Tip {
  title: string;
  body: string;
}

export const TIPS: Record<string, Tip> = {
  welcome: {
    title: 'Chào con! Welcome to the workshop.',
    body: 'Bundles of cut fabric go down the line, one operation at a time. The line only goes as fast as its slowest seamstress, so <b>watch for the tallest pile</b>.<br><br>Lan is on the bench. Pockets are her speciality. <b>Tap her, then tap a machine.</b>',
  },
  pile: {
    title: 'That pile is your bottleneck.',
    body: 'Move a faster seamstress there, or tap a spare machine and give it the same job. The coloured ring around each worker shows her speed: green is fast, red is slow. People get faster as they learn an operation, so every move has a cost.',
  },
  broke: {
    title: 'Snap! A needle broke.',
    body: 'Tap the machine and press <b>Fix</b>: you walk over and change the needle. Bundles pile up while it is down. Worn machines break more often.',
  },
  fax: {
    title: 'Faxes are orders.',
    body: 'Each quote trades size, price per dozen and the vessel date. Bigger orders pay more but leave less room for trouble. The truck to Saigon Port leaves at 16:30 on vessel day.',
  },
  hire: {
    title: 'More machines than hands.',
    body: 'Every operation needs at least one seamstress, or the whole line stops. Open the <b>Team</b> tab and hire. Wages are paid every evening, so hire what you need, not more.',
  },
  changeover: {
    title: 'A new style on the line.',
    body: 'Every machine got a new job for this product. Everyone starts slow on an operation they have never sewn: about half speed. Check the piles again, the bottleneck has moved.',
  },
  vessel: {
    title: 'Vessel day.',
    body: 'Look at the order board: if the order will not be packed by 16:30, switch on <b>overtime</b> before the end of the shift, or decide tonight between air freight and a short shipment.',
  },
  quality: {
    title: 'Mr. Watanabe counts defects.',
    body: 'From now on, every piece can come out defective: low skill, a new operation, a worn needle or a tired seamstress all raise the risk. Hire a <b>QC inspector</b> and seat her at the <b>QC table</b> at the end of the line: she sends defects back for repair before the buyer sees them.',
  },
  mechanic: {
    title: 'You cannot fix everything yourself.',
    body: 'A <b>mechanic</b> notices breakdowns without being asked, repairs twice as fast as you, and changes worn needles before they snap. Look for one in the Team tab.',
  },
  sourcing: {
    title: 'You buy the fabric now.',
    body: 'FOB orders pay more, but the fabric is yours to buy. Open the <b>Fabric</b> tab: the local mill is cheap and close but its shades vary, Korea is perfect but three days away (and customs may hold it), Hong Kong is fast and dear. Order a few spare rolls: bad rolls and scrapped pieces eat into your margin.',
  },
  cutting: {
    title: 'Nothing is sewn before it is cut.',
    body: 'The <b>cutting table</b> feeds every line. Seat a cutter there (or anyone, slower). When a truck arrives, inspect the rolls: an off-shade roll spoils every piece cut from it.',
  },
  power: {
    title: 'Rainy season.',
    body: 'The power goes out every afternoon. Someone must run to the <b>generator</b>; an <b>electrician</b> does it in minutes and knows its tricks. Keep the fabric off the wet floor: buy <b>pallets</b> in the Fabric tab.',
  },
  leaders: {
    title: 'Two lines, one of you.',
    body: 'Hire <b>line leaders</b> and give each a line in the Team tab. Every quarter of an hour they seat the bench, cover empty steps and point spare machines at the slowest step. You keep the big decisions.',
  },
  overlay: {
    title: 'See the line differently.',
    body: 'The <b>◐</b> button on the map shows the bottleneck view (red = the slowest step of each line) and the quality view (defects made today at each machine).',
  },
  morale: {
    title: 'People are not machines, con.',
    body: 'Every seamstress now has a <b>morale</b>. Fans, a canteen and clean water raise it every night; overtime and tiredness lower it. Happy people sew faster and cleaner, and they come back after Tết. Below a third, they leave for a bigger factory. The 1994 Labour Code allows three overtime evenings a month.',
  },
  mentor: {
    title: 'Teach, and the line grows.',
    body: 'Tap a junior seamstress and choose a <b>mentor</b>: a senior who teaches her while sewing a little slower. The junior learns faster and slowly gains the senior’s skill.',
  },
  office: {
    title: 'An office of your own.',
    body: 'A <b>merchandiser</b> answers routine faxes with your quote policy (Team tab) and checks the samples. A <b>production planner</b> buys the fabric and moves waiting orders to idle lines. You keep the inspections, the cut-offs and the family.',
  },
  lines: {
    title: 'More lines than eyes.',
    body: 'The map shows two lines at a time. The buttons at the bottom right switch between them; a red dot means a line needs you (a breakdown, a big pile, or a step with nobody on it).',
  },
  macro: {
    title: 'When the north wind blows.',
    body: 'A crisis far away can empty your lines overnight. Idle people still need wages. You can <b>let people go</b> (Team tab), or keep them and find new work: Má will tell you what she thinks.',
  },
  diversify: {
    title: 'Never one basket, con.',
    body: 'In the Orders tab, <b>New markets</b> costs money now and brings a fax a day or two later: a Saigon fashion house, a European catalogue through Hong Kong, Japanese company uniforms. Start early: new customers need time.',
  },
  cat: {
    title: 'Every factory needs a cat.',
    body: 'Mice love cotton. A cat keeps the warehouse clean and the workers smiling. She sleeps through lunch on the bench.',
  },
  quota: {
    title: 'Paper for every dozen.',
    body: 'America limits how many garments each country sends: every American order needs <b>export quota</b>, bought per dozen in the Orders tab. The price moves every night. Buy early and you may pay too much; wait and a broker charges half again at the cut-off.',
  },
  compliance: {
    title: 'The auditor reads everything, con.',
    body: 'Atlantic Outfitters has a <b>code of conduct</b>: overtime, fire exits, water, fans, tired people, and what your workers say when you are not in the room. The Team tab shows each rule live. Five of six must pass on day 3.',
  },
  inspection: {
    title: 'After the inspection.',
    body: 'The defect report shows which operation, which seamstress and which cause made the defects. Learning and worn needles are the usual suspects; QC catches most of the rest.',
  },
};

export const GLOSSARY: { term: string; text: string }[] = [
  { term: 'CMT', text: 'Cut-Make-Trim: the buyer supplies the fabric and pays you for sewing.' },
  { term: 'SMV', text: 'Standard Minute Value: minutes one operation takes at 100% efficiency.' },
  { term: 'Bundle', text: 'A tied pack of 10 cut pieces that travels through the line.' },
  { term: 'WIP', text: 'Work in progress: the pile waiting in front of a machine.' },
  { term: 'Bottleneck', text: 'The slowest operation; it sets the speed of the whole line.' },
  { term: 'Learning curve', text: 'A seamstress starts a new operation at about half speed and improves with every piece.' },
  { term: 'Per dozen', text: 'Garment prices are quoted per 12 pieces.' },
  { term: 'Vessel cut-off', text: 'The last moment the container can leave for the ship: 16:30 on vessel day.' },
  { term: 'Air freight', text: 'Shipping by plane after missing the vessel: two more days, half the order value.' },
  { term: 'QC', text: 'Quality control: checking garments at the end of the line and sending defects back for repair.' },
  { term: 'AQL', text: 'Acceptable Quality Level: how many defects the buyer tolerates in a random sample.' },
  { term: 'Sample', text: 'A garment approved by the buyer before bulk sewing starts.' },
  { term: 'FOB', text: 'Free On Board: you buy the fabric and deliver to the ship; more money, more risk.' },
  { term: 'Marker', text: 'The layout of pattern pieces on the fabric. A tighter marker wastes less fabric.' },
  { term: 'Off-shade', text: 'A roll whose colour differs a little from the approved one; pieces from it do not match.' },
  { term: 'Changeover', text: 'Switching a line to a new style: everyone is slow again while they learn it.' },
  { term: 'Lockstitch', text: 'The basic sewing machine: one needle, two threads, a straight seam.' },
  { term: 'Overlock', text: 'A machine that sews and trims the edge in one pass, so it does not fray.' },
  { term: 'Bartack', text: 'A short, dense zigzag that reinforces pockets and belt loops.' },
  { term: 'Line leader', text: 'A senior worker who balances her own line: she moves people to the tallest pile.' },
  { term: 'Generator', text: 'A diesel engine that keeps the machines running in a power cut, once someone starts it.' },
  { term: 'Morale', text: 'How people feel about working for you. High morale: faster, cleaner, and they stay.' },
  { term: 'Labour Code', text: 'The 1994 law that, among other things, limits overtime. In the game: three evenings a month.' },
  { term: '13th-month bonus', text: 'A month’s extra pay before Tết. Most Vietnamese workers expect it.' },
  { term: 'Tết', text: 'The Lunar New Year. Everyone goes home to their family in the provinces.' },
  { term: 'Export processing zone', text: 'An industrial park for export factories, with cheaper taxes and real roads.' },
  { term: 'Merchandiser', text: 'The office person who talks to buyers: quotes, samples, faxes.' },
  { term: 'Production planner', text: 'The office person who decides which order goes on which line, and buys the fabric.' },
  { term: 'Severance', text: 'Money paid to someone you let go. In the game: a week of wages.' },
  { term: 'Quota', text: 'A limit on how many garments of a category a country may export to the United States; factories buy the right to ship, per dozen.' },
  { term: 'Code of conduct', text: 'A buyer’s rules for the factories that sew for it: hours, safety, wages, no child labour. Checked by audits.' },
  { term: '1997 crisis', text: 'The Asian financial crisis: from July 1997 the baht, the rupiah and the won fell, and orders vanished.' },
];
