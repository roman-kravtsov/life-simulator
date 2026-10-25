// Text for the adulthood events (EVENT-007), with the notes, choices and outcomes of their decisions.
export const adulthoodStrings: Readonly<Record<string, string>> = {
  "event.adulthood.market_day":
    "A busy market day: the noise, the bargaining, the faces you have known for years. You buy less than you came for and talk more.",
  "event.adulthood.child_first_day":
    "Your child goes off to school for the first time, too small for the bag. You stand at the gate longer than you need to.",
  "event.adulthood.sick_child":
    "Your child is ill for a few bad days, and you spend what you have on getting them well. They are laughing again by the end of the week.",
  "event.adulthood.child_success":
    "{child} does something you did not expect, and does it well. You hear about it from three different people before they tell you themselves.",
  "event.adulthood.parent_visit":
    "You spend a few days with {parent}. They are smaller than you remember and know more than you gave them credit for.",
  "event.adulthood.tired_year":
    "A tired year. Nothing in particular goes wrong, and nothing is quite restful, and your body keeps its own accounts.",
  "event.adulthood.steady_season": "A steady season of work: nothing exceptional, enough. You learn to value enough.",
  "event.adulthood.neighbour_help":
    "A neighbour needs a hand with something heavy, and you give it. Later you need one yourself, and it comes without asking.",
  "event.adulthood.crowded_house":
    "The house is full: relatives, children, others who have nowhere else to go. It is loud, and no one is alone.",
  "event.adulthood.bonus": "An unexpected extra payment arrives, and for a week you feel richer than you are.",
  "event.adulthood.partner_evening":
    "You and {partner} eat late, after everyone else has gone. It is ordinary, and both of you know it is not.",
  "event.adulthood.partner_distance":
    "You and {partner} are in the same room, and somehow elsewhere. Neither of you says so, and it goes on for weeks.",
  "event.adulthood.old_friend_calls":
    "{friend} gets in touch after a long gap. The first minute is awkward and the second is not.",
  "event.adulthood.new_skill":
    "You pick up something new, a craft or a language or a way of keeping accounts, and find that you are still able to.",
  "event.adulthood.near_miss":
    "A moment on the road or at work when you were an inch from a very different year. You sit down afterwards, and the ground feels unusually firm.",
  "event.adulthood.workshop_hours":
    "You spend the evenings mending, making, tending what is yours. No one asks anything of you, and it fills you up.",
  "event.adulthood.workplace_dispute":
    "An argument at work is no one's fault and everyone's problem. It sours the weeks that follow.",
  "event.adulthood.good_year": "A year when the rain, the prices and the luck all line up, and you have a little over.",

  "event.adulthood.second_job":
    "There is extra work on offer, in the evenings and on the weekend. It would help with the money, and with nothing else.",
  "choice.adulthood.second_job.take": "Take the extra work",
  "choice.adulthood.second_job.decline": "Keep your evenings",
  "outcome.adulthood.second_job.take":
    "The money is welcome and the tiredness is more than you thought. By the end of the year your hands remember the work before you do.",
  "outcome.adulthood.second_job.decline": "You keep your evenings, and what you do with them is yours.",

  "event.adulthood.school_fees":
    "The fees for {child}'s school are due, and there is a place for them if you can find the money. There is work for them too, if you cannot.",
  "choice.adulthood.school_fees.pay": "Find the fees",
  "choice.adulthood.school_fees.work": "Let them work instead",
  "outcome.adulthood.school_fees.pay":
    "You find the money, by giving up other things. {child} does not know exactly what it cost, and you hope they never need to.",
  "outcome.adulthood.school_fees.work":
    "{child} goes to work. The household breathes a little easier, and you watch a door close that you had hoped to hold open.",

  "event.adulthood.partner_argument":
    "You and {partner} have been circling an argument for weeks. It could be had, or it could be left.",
  "choice.adulthood.partner_argument.talk": "Sit down and say it",
  "choice.adulthood.partner_argument.leave_it": "Let it lie",
  "outcome.adulthood.partner_argument.heard":
    "It is hard, and it works. Both of you say a thing you have been carrying, and are lighter.",
  "outcome.adulthood.partner_argument.not_heard":
    "You say it, and it is not heard in the way you meant it. You go to bed with the same argument and a little less hope.",
  "outcome.adulthood.partner_argument.leave_it":
    "You let it lie. It lies there, quietly, and takes up more of the house than before.",

  "event.adulthood.neighbour_dispute":
    "A neighbour and you disagree about a boundary, a debt or a noise, and it is getting beyond a joke.",
  "choice.adulthood.neighbour_dispute.negotiate": "Talk it through",
  "choice.adulthood.neighbour_dispute.press": "Press your claim",
  "choice.adulthood.neighbour_dispute.yield": "Give way",
  "outcome.adulthood.neighbour_dispute.settled":
    "You sit on their step, with tea, and agree something both of you can live with.",
  "outcome.adulthood.neighbour_dispute.stalemate":
    "You talk, and neither of you moves. The disagreement settles in for the winter.",
  "outcome.adulthood.neighbour_dispute.won":
    "You get your way. The neighbour does not forgive it quickly, and neither, entirely, do you.",
  "outcome.adulthood.neighbour_dispute.feud":
    "It turns into a feud. The street takes sides, and everyone loses something.",
  "outcome.adulthood.neighbour_dispute.yield": "You give way. It costs you little, and you feel it for a long time.",

  "event.adulthood.career_change":
    "You have been doing the same work for years, and a different path has opened. Learning it would take money, time and a willingness to be a beginner again.",
  "choice.adulthood.career_change.retrain": "Retrain for something new",
  "choice.adulthood.career_change.stay": "Stay where you are",
  "outcome.adulthood.career_change.footing":
    "Being a beginner is humbling, and quicker than you feared. By the end of the year you have a new footing and a new way of standing.",
  "outcome.adulthood.career_change.setback":
    "It does not take. The money is spent and the old place has moved on. You start again, a little humbled.",
  "outcome.adulthood.career_change.stay": "You stay. The work is the work, and it asks for nothing new.",

  "event.adulthood.parent_needs_care":
    "{parent} can no longer manage alone. Someone must do something, and the family looks at you.",
  "choice.adulthood.parent_needs_care.take_in": "Bring them to live with you",
  "choice.adulthood.parent_needs_care.support": "Send money and visit",
  "choice.adulthood.parent_needs_care.leave_to_others": "Leave it to the others",
  "outcome.adulthood.parent_needs_care.take_in":
    "The house rearranges itself. It is hard, and close, and you hear stories you never did before.",
  "outcome.adulthood.parent_needs_care.support":
    "You send what you can and go as often as you can, and it is not as much as either of you would like.",
  "outcome.adulthood.parent_needs_care.leave_to_others":
    "You leave it to the others. It is a fair argument, and it does not feel fair.",

  "note.services": "Here, about {share} of the people at work are in services",
  "note.out_of_pocket": "Here, about {share} of health spending is paid by people themselves",
  "note.lower_secondary": "Here, about {share} of young people finish lower secondary school",
  "event.adulthood.own_roof":
    "You have a roof that is yours: walls you built or bought, a door that locks from the inside. You walk through it slowly, the first night, touching things.",
  "event.adulthood.asked_to_lead":
    "People start bringing their problems to you, and then ask you to speak for them. You never applied for it, and you take it up.",
  "event.adulthood.long_friendship":
    "{friend} has been there through the years. You notice one evening that you no longer thank each other for the small things, because they are not small.",
};
