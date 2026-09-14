// Transcribed from the user-supplied rosters.jpg, 2026-09-14.
// Team numbers and displayed order preserved; divisions and entering averages not supplied.
// Four blank/open positions are vacancies, not inferred people.
export const CONFIRMED_ROSTER=[
  [
    "Lenox Propane",
    "Ric Kovaleski",
    "Riley Possanza",
    "Anthony Possanza",
    "Andrew Vaughan",
    "Mike Shevchuk"
  ],
  [
    "Ridgetop Farms",
    "Mike Monaghan",
    "Jon Born",
    "Mike Straut",
    "Joe Giomento",
    "Jim Curtis"
  ],
  [
    "Aaron Hufford Plumbing",
    "Joe Bruno",
    "Tony Bruno",
    "Josh Koerner",
    "Aaron Hufford",
    "Larry DeLancey"
  ],
  [
    "Events Staging",
    "Conrad Bartholomew",
    "Len Silva",
    "Colin Giordano",
    "Rich Winslow",
    "Brian Hamilton"
  ],
  [
    "Sr. George's",
    "Joe Bolsar",
    "Al Parsells",
    "Steve Pisarchik",
    "Tim Bolsar",
    "John Yablonsky"
  ],
  [
    "Moxie Club",
    "Tom Curtis",
    "Robert Johnson",
    "Bruce Smallacombe",
    "Jim Mican",
    "Bob Johnson"
  ],
  [
    "Complete Chiropractic & Rehab",
    "Jacob Curtis",
    "John Radzikowski",
    "Tom Rosar",
    "Chris Kovalchik",
    "Richie Lei"
  ],
  [
    "Artisan Builders",
    "Chris Conserette Sr.",
    "Chris Conserette Jr.",
    "Sean Merrifield",
    "Jordan Conserette",
    "Brian Conserette"
  ],
  [
    "Perfexxxxion Pro Shop",
    "James Durland",
    "Aniesa Grabowski",
    "Christiana Gebhardt",
    "Joe Sutton",
    "Vince Soriano"
  ],
  [
    "Sharkeys Fuel",
    "Jason Koval",
    "Kayla Wright",
    "Ashley Eakle",
    "Christian Kramer",
    "Doug Smith"
  ],
  [
    "Kellogg's Aeriel Lifts",
    "Rob Reed",
    "Becky Decker",
    "Matt Magdon",
    "Harvey Kellogg",
    "Brad Kellogg"
  ],
  [
    "KC Pepper",
    "Matt Fiorletta",
    "Dave Tuttle",
    "Ryan Kelly",
    "Easton Sampson",
    "Mark Wilmot"
  ],
  [
    "Styles Unlimited",
    "Dylan Shaffer",
    "Husam Thompson",
    "Michael Dinning",
    "Robert Lane",
    "Gary Ladomirak Jr."
  ],
  [
    "Lawlers",
    "Chris Weldon",
    "Jon McDonough",
    "Fred Moase",
    "Pat McDonough",
    "Joe Falvo"
  ],
  [
    "Shale Knob Farms",
    "Ed Bomba",
    "William Hebner",
    "Chris Price",
    "Adam Loughney",
    "Chris DiRienzo"
  ],
  [
    "GIRT",
    "Rich Bergsma",
    "Eddie Gray",
    "Bob Cicci",
    "Jack Dunback",
    "Dave Price"
  ],
  [
    "Advanced Flooring",
    "Dave Bishop Jr.",
    "Josh Kohut",
    "Tom Tomaine",
    "Gary Kohut",
    "Dave Bishop Sr."
  ],
  [
    "Champions Lounge",
    "Al Diskatos",
    null,
    "Pat McDonald",
    "Adam Grabowski",
    "Allan Ross"
  ],
  [
    "H I S Benefits",
    "Eugene Kashuba Jr.",
    "Derek Buffington",
    "Steve Johnson",
    "Gene Kashuba III",
    "Bryan Foytack"
  ],
  [
    "New Team #1",
    "Jason Perch",
    "Adam Patterson",
    null,
    null,
    null
  ]
];
export function loadConfirmedRoster(state){
 if(state.results.length||state.teams.length||state.bowlers.length)throw Error('Load the confirmed roster only into an empty workspace.');
 const next=structuredClone(state);
 for(const [i,row] of CONFIRMED_ROSTER.entries()){
  const team=i+1,players=[];
  row.slice(1).forEach((name,slot)=>{
   const id='monday-'+String(team).padStart(2,'0')+'-'+(slot+1);
   players.push(id);next.bowlers.push({id,name:name||'Vacancy — Team '+team+' slot '+(slot+1),team,entering:null,vacancy:name===null,history:[]});
  });
  next.teams.push({number:team,name:row[0],division:'',players});
 }
 next.sourceNotes=['Roster transcribed from rosters.jpg supplied 2026-09-14. Team numbers and listed order preserved.','96 named bowlers and four open positions; entering averages and divisions pending.','2025-2026 Player History.zip received but not yet extracted.','Official schedule pending.'];
 return next;
}
