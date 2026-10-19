/**
 * Archetype library for Focus Ladder.
 *
 * Each archetype describes a family of tasks and a template ladder for it.
 * Rules every template obeys (enforced by tests in tests/engine.test.js):
 *   - every rung is 5 minutes or less
 *   - the first rung is a `setup` rung of 2 minutes or less and is physical:
 *     open, fetch, stand up, put in front of you
 *   - language is plain, concrete and kind; no "just", "simply", "should have"
 *   - `loop: true` marks the rung that repeats once per unit when the task
 *     has a quantity ("read 3 chapters")
 *
 * Placeholders: {object} is the task object ("the essay on rivers"),
 * {n} is the loop index, {unit} is the singular unit ("chapter").
 */

export const KINDS = /** @type {const} */ ({
  setup: {
    why: 'Starting is the hardest part. A physical first move makes the next rung real.'
  },
  work: {
    why: 'Five minutes of imperfect progress beats an hour of waiting to feel ready.'
  },
  wrap: {
    why: 'Closing the loop stops the task from following you around in your head.'
  }
});

/** @typedef {{t:string, min:number, kind:'setup'|'work'|'wrap', loop?:boolean}} StepTemplate */
/** @typedef {{id:string, label:string, match:string[], steps:StepTemplate[], weight?:number}} Archetype */

/** @type {Archetype[]} */
export const ARCHETYPES = [
  {
    id: 'write',
    label: 'Writing',
    match: ['write', 'essay', 'report', 'draft', 'paper', 'blog', 'article', 'cover letter', 'thesis', 'dissertation', 'statement', 'proposal', 'journal', 'letter', 'post', 'documentation', 'readme'],
    steps: [
      { t: 'Open a blank document and name it "{object}"', min: 2, kind: 'setup' },
      { t: 'Type one messy sentence saying what {object} is for', min: 3, kind: 'work' },
      { t: 'List three bullet points you definitely want in it', min: 5, kind: 'work' },
      { t: 'Turn bullet {n} into a rough paragraph. Typos are allowed.', min: 5, kind: 'work', loop: true },
      { t: 'Read it once out loud and fix only what trips your tongue', min: 5, kind: 'wrap' },
      { t: 'Save it and write tomorrow\'s first move on a sticky note', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'study',
    label: 'Studying',
    match: ['study', 'revise', 'revision', 'exam', 'test prep', 'memorise', 'memorize', 'learn', 'flashcards', 'quiz', 'midterm', 'finals', 'lecture notes'],
    steps: [
      { t: 'Put the notes or book for {object} in front of you and open to the first page you need', min: 2, kind: 'setup' },
      { t: 'Write the three topics you are least sure about on one line', min: 3, kind: 'work' },
      { t: 'Read the first topic for five minutes. Underline, don\'t copy.', min: 5, kind: 'work', loop: true },
      { t: 'Close the notes and say the main idea out loud in your own words', min: 3, kind: 'work' },
      { t: 'Write two questions you could be asked, with one-line answers', min: 5, kind: 'wrap' },
      { t: 'Decide the next topic and leave the book open on that page', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'read',
    label: 'Reading',
    match: ['read', 'reading', 'chapter', 'textbook', 'skim', 'go through the paper', 'literature'],
    steps: [
      { t: 'Open {object} to where you need to start and put your phone face down', min: 2, kind: 'setup' },
      { t: 'Read the headings and the first sentence of each section', min: 4, kind: 'work' },
      { t: 'Read {unit} {n} for five minutes. Mark anything confusing with a dot.', min: 5, kind: 'work', loop: true },
      { t: 'Write one sentence about what you have read so far', min: 3, kind: 'wrap' },
      { t: 'Put a bookmark in and note the next starting page', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'email',
    label: 'Email or message',
    match: ['email', 'e-mail', 'reply', 'respond', 'message', 'text', 'inbox', 'write back', 'follow up', 'follow-up', 'dm', 'slack'],
    steps: [
      { t: 'Find the message thread for {object} and read it once', min: 2, kind: 'setup' },
      { t: 'Write the one sentence you most need to say, in plain words', min: 3, kind: 'work' },
      { t: 'Add a greeting and a sign-off. Short is kind.', min: 2, kind: 'work' },
      { t: 'Read it once for tone, then press send', min: 3, kind: 'wrap' },
      { t: 'Archive the thread or mark it done', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'call',
    label: 'Phone call',
    match: ['call', 'phone', 'ring', 'dial', 'book an appointment', 'make an appointment', 'reschedule'],
    steps: [
      { t: 'Find the number for {object} and write it on paper', min: 2, kind: 'setup' },
      { t: 'Write three bullet points of what you need to say or ask', min: 3, kind: 'work' },
      { t: 'Write the first sentence you will say word for word', min: 2, kind: 'work' },
      { t: 'Dial. If voicemail, read your first sentence and leave your number.', min: 5, kind: 'work' },
      { t: 'Write down what was agreed and any date or reference number', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'clean',
    label: 'Cleaning or tidying',
    match: ['clean', 'tidy', 'declutter', 'organise', 'organize', 'room', 'desk', 'kitchen', 'bathroom', 'closet', 'wardrobe', 'mess', 'vacuum', 'hoover', 'mop', 'sweep', 'wipe'],
    steps: [
      { t: 'Stand in {object} with a bin bag and an empty box', min: 1, kind: 'setup' },
      { t: 'Put every piece of rubbish you can see in the bag', min: 5, kind: 'work' },
      { t: 'Put anything that lives in another room into the box', min: 5, kind: 'work' },
      { t: 'Clear one flat surface completely. Only one.', min: 5, kind: 'work', loop: true },
      { t: 'Carry the box around and put things back where they live', min: 5, kind: 'wrap' },
      { t: 'Take the bin bag out and look at the surface you cleared', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'laundry',
    label: 'Laundry',
    match: ['laundry', 'washing', 'clothes', 'wash clothes', 'dryer', 'fold'],
    steps: [
      { t: 'Put the laundry basket next to the machine', min: 1, kind: 'setup' },
      { t: 'Load the machine, add detergent, press start', min: 4, kind: 'work' },
      { t: 'Set a timer for when the cycle ends and do something else', min: 1, kind: 'work' },
      { t: 'Move the wet load to the dryer or rack', min: 4, kind: 'work' },
      { t: 'Fold or hang five items. Only five.', min: 5, kind: 'wrap', loop: true },
      { t: 'Put the folded pile where it belongs', min: 3, kind: 'wrap' }
    ]
  },
  {
    id: 'dishes',
    label: 'Dishes',
    match: ['dishes', 'washing up', 'sink', 'dishwasher', 'plates'],
    steps: [
      { t: 'Stand at the sink and run the hot water', min: 1, kind: 'setup' },
      { t: 'Stack everything into one pile beside the sink', min: 3, kind: 'work' },
      { t: 'Wash the glasses and cups first', min: 5, kind: 'work' },
      { t: 'Wash the plates and cutlery', min: 5, kind: 'work' },
      { t: 'Wash the pans and wipe the counter', min: 5, kind: 'wrap' }
    ]
  },
  {
    id: 'cook',
    label: 'Cooking',
    match: ['cook', 'dinner', 'lunch', 'breakfast', 'meal', 'recipe', 'bake', 'food', 'meal prep'],
    steps: [
      { t: 'Decide what to make for {object} and say it out loud', min: 2, kind: 'setup' },
      { t: 'Take every ingredient out and put it on the counter', min: 4, kind: 'work' },
      { t: 'Get out the pan, board and knife you need', min: 2, kind: 'work' },
      { t: 'Do the first prep step: chop, boil water or preheat', min: 5, kind: 'work' },
      { t: 'Cook. Set a timer so you can stop watching the pan.', min: 5, kind: 'work' },
      { t: 'Plate up and put one thing back in the fridge', min: 3, kind: 'wrap' }
    ]
  },
  {
    id: 'shop',
    label: 'Shopping or groceries',
    match: ['groceries', 'grocery', 'shopping', 'buy', 'shop', 'order', 'supermarket', 'pharmacy', 'pick up'],
    steps: [
      { t: 'Open your notes app and title a list "{object}"', min: 1, kind: 'setup' },
      { t: 'Open the fridge and cupboard and write what is missing', min: 4, kind: 'work' },
      { t: 'Add anything you need for the next two days of meals', min: 3, kind: 'work' },
      { t: 'Put shoes, wallet and bag by the door, or open the shop\'s website', min: 2, kind: 'work' },
      { t: 'Go, or place the order. Stick to the list.', min: 5, kind: 'wrap' }
    ]
  },
  {
    id: 'admin',
    label: 'Forms, bills and admin',
    match: ['form', 'bill', 'pay', 'invoice', 'tax', 'taxes', 'insurance', 'bank', 'paperwork', 'admin', 'renew', 'register', 'visa', 'passport', 'licence', 'license', 'claim', 'refund', 'fee', 'fees', 'submit the'],
    steps: [
      { t: 'Open the page or paper for {object} and nothing else', min: 2, kind: 'setup' },
      { t: 'Read it once and circle or list what information it asks for', min: 4, kind: 'work' },
      { t: 'Gather the documents or numbers it needs into one folder', min: 5, kind: 'work' },
      { t: 'Fill in the first section only', min: 5, kind: 'work' },
      { t: 'Fill in the next section', min: 5, kind: 'work', loop: true },
      { t: 'Check the names and dates, then submit or pay', min: 4, kind: 'wrap' },
      { t: 'Screenshot the confirmation and file it', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'apply',
    label: 'Applying for something',
    match: ['apply', 'application', 'job', 'internship', 'scholarship', 'grant', 'cv', 'resume', 'résumé', 'portfolio', 'interview'],
    steps: [
      { t: 'Open the posting for {object} and copy the deadline to the top of a new note', min: 2, kind: 'setup' },
      { t: 'List what they ask for: CV, letter, forms, references', min: 3, kind: 'work' },
      { t: 'Open your most recent CV and change the date and title', min: 5, kind: 'work' },
      { t: 'Write three bullet points matching their words to your experience', min: 5, kind: 'work' },
      { t: 'Draft the first paragraph of the letter badly', min: 5, kind: 'work' },
      { t: 'Save everything into one folder named "{object}"', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'assignment',
    label: 'Problem set or assignment',
    match: ['assignment', 'homework', 'problem set', 'pset', 'exercises', 'worksheet', 'questions', 'lab report', 'coursework', 'tutorial sheet'],
    steps: [
      { t: 'Open {object} and put a pen and paper next to you', min: 2, kind: 'setup' },
      { t: 'Read every question once without solving. Star the easiest.', min: 4, kind: 'work' },
      { t: 'Write the given information for the starred question', min: 3, kind: 'work' },
      { t: 'Work on {unit} {n} for five minutes. Partial answers count.', min: 5, kind: 'work', loop: true },
      { t: 'Mark which questions are done, half-done and untouched', min: 2, kind: 'wrap' },
      { t: 'Write one question you want to ask a classmate or tutor', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'code',
    label: 'Coding or debugging',
    match: ['code', 'bug', 'debug', 'fix', 'implement', 'refactor', 'deploy', 'pull request', 'pr', 'feature', 'script', 'program', 'function', 'test', 'tests', 'commit', 'merge', 'repo'],
    steps: [
      { t: 'Open the project for {object} and the one file you think matters most', min: 2, kind: 'setup' },
      { t: 'Write in a comment what "done" looks like in one sentence', min: 3, kind: 'work' },
      { t: 'Reproduce the problem or run the current code once', min: 5, kind: 'work' },
      { t: 'Make the smallest change that moves toward done', min: 5, kind: 'work' },
      { t: 'Run it again. Note what changed.', min: 4, kind: 'work' },
      { t: 'Commit with a plain message, even if unfinished', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'slides',
    label: 'Presentation',
    match: ['presentation', 'slides', 'slide deck', 'deck', 'talk', 'pitch', 'present', 'demo'],
    steps: [
      { t: 'Open a new deck and type the title of {object} on slide one', min: 2, kind: 'setup' },
      { t: 'Write the one sentence your audience should remember', min: 3, kind: 'work' },
      { t: 'Make five empty slides with only a heading each', min: 5, kind: 'work' },
      { t: 'Fill slide {n} with three bullets or one picture', min: 5, kind: 'work', loop: true },
      { t: 'Say the talk out loud once, standing up', min: 5, kind: 'wrap' },
      { t: 'Export a PDF copy as a backup', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'meeting',
    label: 'Meeting preparation',
    match: ['meeting', 'prep for', 'agenda', 'one-on-one', '1:1', 'standup', 'review meeting', 'supervisor', 'advisor', 'professor'],
    steps: [
      { t: 'Open a note titled "{object}" and the calendar invite', min: 1, kind: 'setup' },
      { t: 'Write the one outcome you want from the meeting', min: 3, kind: 'work' },
      { t: 'List three things to say and one question to ask', min: 5, kind: 'work' },
      { t: 'Find any file or number you might be asked about', min: 5, kind: 'work' },
      { t: 'Put the note where you will see it during the meeting', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'pack',
    label: 'Packing or travel',
    match: ['pack', 'packing', 'suitcase', 'trip', 'travel', 'flight', 'train', 'move out', 'moving', 'luggage'],
    steps: [
      { t: 'Put the bag for {object} open on the bed', min: 1, kind: 'setup' },
      { t: 'Put in documents, charger, medication and wallet first', min: 3, kind: 'work' },
      { t: 'Count the days and lay out one outfit per day', min: 5, kind: 'work' },
      { t: 'Pack the toiletries bag', min: 4, kind: 'work' },
      { t: 'Put the clothes in and zip it', min: 4, kind: 'wrap' },
      { t: 'Stand the bag by the door', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'exercise',
    label: 'Exercise',
    match: ['exercise', 'workout', 'gym', 'run', 'running', 'walk', 'yoga', 'stretch', 'swim', 'cycle', 'bike'],
    steps: [
      { t: 'Put on your shoes or workout clothes. That is the whole rung.', min: 2, kind: 'setup' },
      { t: 'Fill a water bottle and pick the music or podcast', min: 2, kind: 'work' },
      { t: 'Step outside or onto the mat and move gently for five minutes', min: 5, kind: 'work' },
      { t: 'Keep going for another five. You can stop after this one.', min: 5, kind: 'work' },
      { t: 'Stretch for three minutes and drink the water', min: 3, kind: 'wrap' }
    ]
  },
  {
    id: 'health',
    label: 'Health appointment',
    match: ['doctor', 'dentist', 'appointment', 'prescription', 'medication', 'meds', 'therapy', 'therapist', 'clinic', 'hospital', 'gp', 'vaccine', 'checkup'],
    steps: [
      { t: 'Find the contact details for {object} and write them down', min: 2, kind: 'setup' },
      { t: 'Write two sentences describing what you need and since when', min: 3, kind: 'work' },
      { t: 'Open your calendar and pick two times that work', min: 2, kind: 'work' },
      { t: 'Call or open the booking page and book it', min: 5, kind: 'work' },
      { t: 'Put the appointment in your calendar with a reminder the day before', min: 2, kind: 'wrap' }
    ]
  },
  {
    id: 'errand',
    label: 'Errand',
    match: ['errand', 'post office', 'return', 'drop off', 'collect', 'parcel', 'package', 'library', 'bank', 'deliver'],
    steps: [
      { t: 'Put the item for {object} by the door with your keys', min: 2, kind: 'setup' },
      { t: 'Check the opening hours and the address', min: 3, kind: 'work' },
      { t: 'Put any receipt or reference number in your pocket or phone', min: 2, kind: 'work' },
      { t: 'Put on your shoes and go', min: 5, kind: 'work' },
      { t: 'When back, cross it off and put your keys back', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'files',
    label: 'Sorting files or photos',
    match: ['files', 'folders', 'photos', 'downloads', 'desktop', 'backup', 'back up', 'sort', 'archive', 'notes', 'bookmarks', 'tabs'],
    steps: [
      { t: 'Open the folder or app for {object} and make one new folder called "Sorted"', min: 2, kind: 'setup' },
      { t: 'Sort by date and delete anything obviously useless from the top', min: 5, kind: 'work' },
      { t: 'Move ten items into Sorted. Only ten.', min: 5, kind: 'work', loop: true },
      { t: 'Rename the three most important items so you can find them', min: 4, kind: 'wrap' },
      { t: 'Close the window. Unfinished is fine.', min: 1, kind: 'wrap' }
    ]
  },
  {
    id: 'decide',
    label: 'Deciding or planning',
    match: ['decide', 'decision', 'choose', 'plan', 'planning', 'figure out', 'think about', 'research', 'compare', 'look into', 'options'],
    steps: [
      { t: 'Write "{object}" at the top of a blank page', min: 1, kind: 'setup' },
      { t: 'List every option you can think of, including bad ones', min: 5, kind: 'work' },
      { t: 'Cross out the ones you already know you will not pick', min: 2, kind: 'work' },
      { t: 'For the top two, write one line of upside and one of downside', min: 5, kind: 'work' },
      { t: 'Pick one for now and write the first tiny action it needs', min: 3, kind: 'wrap' }
    ]
  },
  {
    id: 'project',
    label: 'Big project',
    // Broad verbs, so this archetype only wins when nothing specific matches.
    weight: 0.5,
    match: ['project', 'start', 'begin', 'finish', 'complete', 'work on', 'build', 'make', 'create', 'set up', 'setup', 'launch', 'website', 'app'],
    steps: [
      { t: 'Open or create the folder for {object} and nothing else', min: 2, kind: 'setup' },
      { t: 'Write what "done for today" looks like in one sentence', min: 3, kind: 'work' },
      { t: 'List the three pieces this project is made of', min: 4, kind: 'work' },
      { t: 'Pick the easiest piece and do its first visible step', min: 5, kind: 'work' },
      { t: 'Do the next small bit of that piece', min: 5, kind: 'work' },
      { t: 'Write a two-line note of where you stopped and what is next', min: 2, kind: 'wrap' }
    ]
  }
];

/**
 * Fallback used when nothing matches. Deliberately generic but still
 * physical first.
 * @type {Archetype}
 */
export const GENERIC = {
  id: 'generic',
  label: 'Any task',
  match: [],
  steps: [
    { t: 'Put everything you need for {object} in front of you', min: 2, kind: 'setup' },
    { t: 'Write down what "done" looks like in one sentence', min: 3, kind: 'work' },
    { t: 'Do the smallest visible first step', min: 5, kind: 'work' },
    { t: 'Do the next small bit', min: 5, kind: 'work' },
    { t: 'Look at what changed and write one line about what is next', min: 3, kind: 'wrap' }
  ]
};

export const ALL_ARCHETYPES = [...ARCHETYPES, GENERIC];
