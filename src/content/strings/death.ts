// The closing passages (DEATH-002): one per cause group, in the normal and the softened telling, and a
// line for the stage of life the person dies in. Never graphic: nothing of the body, the method or the place.
export const deathStrings: Readonly<Record<string, string>> = {
  "cause.maternal": "complications of pregnancy or childbirth",

  "death.passage.infection":
    "An infection takes hold, and this time the body cannot turn it back. The people around you do what can be done. The fever is long, and then it is over.",
  "death.passage.infection.soft": "An infection takes you, and the people around you are close.",
  "death.passage.earlyLife":
    "Something was uncertain from the start, and all the care around you is not enough to settle it. You go quietly, held.",
  "death.passage.earlyLife.soft": "You were born with more than a body could carry, and you die, held.",
  "death.passage.childbirth":
    "A birth that should have been a beginning is where your strength gives out. The people near you do what they can, and it is not enough.",
  "death.passage.childbirth.soft": "You die in childbirth, with people near you.",
  "death.passage.hunger":
    "There has not been enough food for a long time, and the body has spent all it had. The hunger was never a story you told. It was the weather of your days, until it ended them.",
  "death.passage.hunger.soft": "Years of too little food have worn the body down, and you die.",
  "death.passage.cancer":
    "The illness that grew quietly makes itself known, and then makes itself the whole of the days. Pain is eased where it can be. At the end there is mostly tiredness, and the people who stayed.",
  "death.passage.cancer.soft": "An illness that grew over years takes you, and people are with you.",
  "death.passage.heart":
    "Your heart, which has kept time for you all these years, falters. There is a moment of surprise, and then no more need for hurry.",
  "death.passage.heart.soft": "Your heart stops, and your life ends.",
  "death.passage.lungs":
    "Breathing has been work for a long time, and now the work is too much. The room is quiet, and each breath is a little smaller than the one before.",
  "death.passage.lungs.soft": "Years of struggling for breath come to an end, and so does your life.",
  "death.passage.longIllness":
    "A long illness, looked after and neglected and looked after again, takes more than the body can give back. It is not dramatic. It is the slow closing of a door that has stood ajar for years.",
  "death.passage.longIllness.soft": "A long illness takes you at last.",
  "death.passage.accident": "It is an ordinary day, and then a moment that changes it. There is no time to be afraid.",
  "death.passage.accident.soft": "An accident ends your life, quickly.",
  "death.passage.violence":
    "Someone's anger finds you. It is over quickly. What comes after is for the people left behind to carry.",
  "death.passage.violence.soft": "Violence ends your life.",
  "death.passage.war":
    "The fighting that has hung over your country reaches you. It does not ask who you are, or what you meant to do.",
  "death.passage.war.soft": "War takes your life.",
  "death.passage.selfHarm":
    "The pain had grown larger than the ways you had to carry it, and you could not see another way. You take your own life. That was not the whole of who you were.",
  "death.passage.selfHarm.soft": "The pain became more than you could carry, and your life ends.",
  "death.passage.other":
    "Something not easily named ends your life. The records will have a word for it. The people who knew you will have others.",
  "death.passage.other.soft": "Your life ends.",

  "death.coda.infancy": "You were so small. The people who loved you will not forget the weight of you in their arms.",
  "death.coda.childhood": "You had barely begun. There were years ahead of you that no one gets to see.",
  "death.coda.adolescence": "You were still becoming someone, and the people who knew you will go on wondering who.",
  "death.coda.youth": "There was so much still ahead: work, love, ordinary mornings.",
  "death.coda.adulthood": "People relied on you, and they will feel the gap in the days.",
  "death.coda.midlife":
    "A great deal of your life was still being lived. What you built stays with the people around you.",
  "death.coda.elder": "You have lived a long life, and what you leave is in the people who knew you.",
};
