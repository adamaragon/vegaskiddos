// Event illustration types. One template image per type is stored on R2 at
// img.vegaskiddos.com/type/<id>/<width>.webp and reused across events, so a
// Kids Cafe never inherits video-game art just because the blurb mentioned teens.

export const ART_TEMPLATES_VERSION = "1";

export type ArtTypeId =
  | "yoga"
  | "food"
  | "market"
  | "ice-cream"
  | "storytime"
  | "swim"
  | "art"
  | "stem"
  | "dino"
  | "animals"
  | "music"
  | "dance"
  | "theater"
  | "gaming"
  | "scavenger"
  | "boardgame"
  | "baby"
  | "nature"
  | "festival"
  | "celebration";

export type ArtType = {
  id: ArtTypeId;
  subject: string;
  emoji: string;
  gradient: string;
};

export const ART_TYPES: Record<ArtTypeId, ArtType> = {
  yoga: {
    id: "yoga",
    subject: "a parent and a small child on yoga mats stretching toward a calm smiling sun, with a water bottle and a tiny plant",
    emoji: "🧘",
    gradient: "from-teal to-sunny",
  },
  food: {
    id: "food",
    subject: "cookies, cupcakes, a sandwich on a lunch tray, and a carton of milk",
    emoji: "🍪",
    gradient: "from-sunny to-coral",
  },
  market: {
    id: "market",
    subject: "a farmers market with fruit and veggie stands",
    emoji: "🧺",
    gradient: "from-sunny to-teal",
  },
  "ice-cream": {
    id: "ice-cream",
    subject: "colorful ice cream cones, scoops, and a sundae topped with sprinkles and a cherry",
    emoji: "🍦",
    gradient: "from-coral to-sunny",
  },
  storytime: {
    id: "storytime",
    subject: "an open storybook with friendly characters drifting out",
    emoji: "📚",
    gradient: "from-teal to-grape",
  },
  swim: {
    id: "swim",
    subject: "a cheerful splashing pool scene",
    emoji: "🏊",
    gradient: "from-teal to-grape",
  },
  art: {
    id: "art",
    subject: "paint pots, brushes and craft supplies",
    emoji: "🎨",
    gradient: "from-coral to-sunny",
  },
  stem: {
    id: "stem",
    subject: "playful little robots and bubbling science beakers",
    emoji: "🔬",
    gradient: "from-teal to-sunny",
  },
  dino: {
    id: "dino",
    subject: "a cute friendly cartoon dinosaur",
    emoji: "🦕",
    gradient: "from-teal to-grape",
  },
  animals: {
    id: "animals",
    subject: "friendly cartoon animals",
    emoji: "🦁",
    gradient: "from-sunny to-coral",
  },
  music: {
    id: "music",
    subject: "colorful musical instruments and floating music notes",
    emoji: "🎵",
    gradient: "from-grape to-coral",
  },
  dance: {
    id: "dance",
    subject: "joyful dancing figures and ribbons",
    emoji: "💃",
    gradient: "from-coral to-grape",
  },
  theater: {
    id: "theater",
    subject: "a little puppet-theater stage with curtains",
    emoji: "🎭",
    gradient: "from-grape to-coral",
  },
  gaming: {
    id: "gaming",
    subject: "game controllers and playful arcade shapes",
    emoji: "🎮",
    gradient: "from-grape to-teal",
  },
  scavenger: {
    id: "scavenger",
    subject: "a treasure map and a magnifying glass",
    emoji: "🔍",
    gradient: "from-teal to-sunny",
  },
  boardgame: {
    id: "boardgame",
    subject: "oversized board-game pieces and puzzle shapes",
    emoji: "♟️",
    gradient: "from-grape to-teal",
  },
  baby: {
    id: "baby",
    subject: "soft toys and stacking blocks for little ones",
    emoji: "🧸",
    gradient: "from-sunny to-coral",
  },
  nature: {
    id: "nature",
    subject: "a sunny garden with plants and butterflies",
    emoji: "🌳",
    gradient: "from-teal to-sunny",
  },
  festival: {
    id: "festival",
    subject: "a festive carnival scene with balloons and bunting",
    emoji: "🎉",
    gradient: "from-coral to-sunny",
  },
  celebration: {
    id: "celebration",
    subject: "balloons, confetti and a cheerful celebration",
    emoji: "🎈",
    gradient: "from-coral to-sunny",
  },
};

export const ART_TYPE_IDS = Object.keys(ART_TYPES) as ArtTypeId[];

// Title is matched first (specific activity beats a word in the blurb).
const TITLE_RULES: [RegExp, ArtTypeId][] = [
  [/\byoga\b/, "yoga"],
  [/kids?\s*cafe|\bcafe\b/, "food"],
  [/farmer['’]?s?\s*market/, "market"],
  [/ice\s*cream|gelato|\bsundae\b|snow\s*cone|popsicle|frozen yogurt|\bfroyo\b/, "ice-cream"],
  [/story\s*time|storytime|story\s*walk/, "storytime"],
  [/swim|splash|\bpool\b|water play|splash\s*pads?/, "swim"],
  [/\bart\b|paint|crafts?|\bdraw\b/, "art"],
  [/science|\bstem\b|lego|robot|coding|maker|experiment/, "stem"],
  [/dino|jurassic|fossil/, "dino"],
  [/animal|\bzoo\b|reptile|petting|touch tank|aquarium|shark|\bbugs?\b/, "animals"],
  [/\bmusic\b|concert|sing-along|\bband\b|drum|ukulele|filharmonic/, "music"],
  [/dance|ballet|zumbini|ballroom/, "dance"],
  [/puppet|theat|magic|circus|\bstage\b|drama|\bmusicals?\b/, "theater"],
  [/video\s*games?|game\s*day|gaming|esports?|\banime\b/, "gaming"],
  [/board\s*games?/, "boardgame"],
  [/scavenger|\bhunt\b/, "scavenger"],
  [/\bchess\b|\bpuzzle\b/, "boardgame"],
  [/lapsit|toddler\s*time|baby\s*time|mommy\s*and\s*me|infant/, "baby"],
  [/farmer['’]?s?\s*market|\bvendors?\b/, "market"],
  [/\bmarkets?\b/, "market"],
  [/nature|garden|hike|trail|butterfly|preserve|\bfarm\b/, "nature"],
  [/festival|parade|\bfair\b|carnival|fiesta/, "festival"],
  [/cook|baking|\bfood\b|\beat\b|snack|\bmeals?\b|lunch|dinner|breakfast/, "food"],
];

// Description is a fallback. Tightened so "teens", "ready", "outdoor", and
// "games" in a kids-program blurb don't steal the type.
const DESC_RULES: [RegExp, ArtTypeId][] = [
  [/\byoga\b/, "yoga"],
  [/kids?\s*cafe|\bcafe\b|three square|\bmeals?\b/, "food"],
  [/farmer['’]?s?\s*market/, "market"],
  [/ice\s*cream|gelato|\bsundae\b|snow\s*cone|popsicle|frozen yogurt|\bfroyo\b/, "ice-cream"],
  [/story\s*time|storytime|story\s*walk|\bread\b\s+books?/, "storytime"],
  [/swim|splash|\bpool\b|water play|splash\s*pads?/, "swim"],
  [/\bart\b|paint|crafts?|\bdraw\b/, "art"],
  [/science|\bstem\b|lego|robot|coding|maker|experiment/, "stem"],
  [/dino|jurassic|fossil/, "dino"],
  [/animal|\bzoo\b|reptile|petting|touch tank|aquarium|shark|\bbugs?\b/, "animals"],
  [/\bmusic\b|concert|sing-along|\bband\b|drum|ukulele|filharmonic/, "music"],
  [/dance|ballet|zumbini|ballroom/, "dance"],
  [/puppet|theat|magic|circus|\bstage\b|drama|\bmusicals?\b/, "theater"],
  [/video\s*games?|game\s*day|gaming|esports?|\banime\b/, "gaming"],
  [/board\s*games?/, "boardgame"],
  [/scavenger|\bhunt\b/, "scavenger"],
  [/\bchess\b|\bpuzzle\b/, "boardgame"],
  [/cook|baking|\bfood\b|snack/, "food"],
  [/\bmarkets?\b/, "market"],
  [/lapsit|toddler\s*time|infant/, "baby"],
  [/nature|garden|hike|trail|butterfly|preserve/, "nature"],
  [/festival|parade|\bfair\b|carnival|fiesta/, "festival"],
];

function firstMatch(text: string, rules: [RegExp, ArtTypeId][]): ArtTypeId | null {
  for (const [re, id] of rules) if (re.test(text)) return id;
  return null;
}

export function artTypeFor(title: string, description = ""): ArtType {
  const id =
    firstMatch(title.toLowerCase(), TITLE_RULES) ||
    firstMatch(description.toLowerCase(), DESC_RULES) ||
    "celebration";
  return ART_TYPES[id];
}

export function subjectFor(title: string, description = ""): string {
  return artTypeFor(title, description).subject;
}

export function artTemplateSrc(typeId: ArtTypeId): string {
  return `/type/${typeId}/1024.webp?v=${ART_TEMPLATES_VERSION}`;
}
