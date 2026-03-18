export type OraCorpusKind = "article" | "book" | "white-paper";

export type OraCorpusEntry = {
  id: string;
  kind: OraCorpusKind;
  sourceFile: string;
  excerpt: string;
};

export const oraCorpus: OraCorpusEntry[] = [
  {
    id: "interpretable-ai-text-detection",
    kind: "article",
    sourceFile: "2603.15034v1.pdf",
    excerpt:
      "Tasks of machine-generated text detection and attribution increasingly appear in the form of shared tasks, such as SemEval, AuTexTification, or RuATD. Within AuTexTification 2023, the system by Przybyla et al. introduced an architecture that combined transformer-based embeddings, probabilistic features derived from language models, and traditional linguistic statistics. This approach improved performance, but it had some limitations.",
  },
  {
    id: "diagnostic-interview-for-narcissistic-patients",
    kind: "article",
    sourceFile: "ArcGenPsychDINGundersonRonningstametal1990.pdf",
    excerpt:
      "This report describes the content and development of a semistructured interview, the Diagnostic Interview for Narcissism. The interview evaluates 33 features of pathological narcissism covering five domains of function: grandiosity, interpersonal relations, reactiveness, affects and moods, and social and moral adaptation. Its utility is established by reliability studies and by developing a scoring system from a sample of prototypic narcissistic patients who were compared with others.",
  },
  {
    id: "state-of-ai-2023",
    kind: "white-paper",
    sourceFile: "State of AI Report 2023 - ONLINE.pdf",
    excerpt:
      "Artificial intelligence is a multidisciplinary field of science and engineering whose goal is to create intelligent machines. We believe that AI will be a force multiplier on technological progress in our increasingly digital, data-driven world. This is because everything around us today, ranging from culture to consumer products, is a product of intelligence. The State of AI Report is a compilation of the most interesting things we have seen with a goal of triggering an informed conversation about the state of AI and its implication for the future.",
  },
  {
    id: "oprah-winfrey-and-the-glamour-of-misery",
    kind: "book",
    sourceFile:
      "Eva Illouz - Oprah Winfrey and the Glamour of Misery_ An Essay on Popular Culture-Columbia University Press (2003).pdf",
    excerpt:
      "The Oprah Winfrey Show has become a text of breathtaking proportions, stretching from the United States to India, Europe, Africa, and Asia. It is remarkable not only for the variety of issues it addresses, the scope of its influence, and the size of its audience, but also because few global media empires are the outcome of one person's single-handed enterprise. This is not to deny that the shrewd and aggressive marketing strategies of the King Corporation have played an important role in helping Oprah gain the upper hand in the market. But her success has been so swift, significant, and durable that the economic explanation alone will not do.",
  },
  {
    id: "the-end-of-love",
    kind: "book",
    sourceFile:
      "Eva Illouz - The End of Love_ A Sociology of Negative Relations-Oxford University Press (2019).pdf",
    excerpt:
      "Western culture has endlessly represented the ways in which love miraculously erupts in people's lives, the mythical moment in which one knows someone is destined to us, the feverish waiting for a phone call or an email, and the thrill that runs our spine at the mere thought of another person. Yet a culture that has so much to say about love is far more silent on the no-less-mysterious moment when we avoid falling in love, when we fall out of love, or when the one who kept us awake at night now leaves us indifferent. This silence is all the more puzzling because the number of relationships that dissolve soon after their beginning is staggering.",
  },
];

export function findCorpusEntryByKind(kind: OraCorpusKind) {
  return oraCorpus.find((entry) => entry.kind === kind) ?? null;
}
