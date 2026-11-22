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
];
