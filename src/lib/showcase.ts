/**
 * Hero showcase pairs. `generated: true` means the output image was produced by
 * the real Nano Banana route (see scripts/generate-showcase.mjs). Concept art is
 * labelled as such on the page, so nothing is presented as generated when it isn't.
 */
export type ShowcasePair = {
  input: { src: string; alt: string; label: string };
  output: { src: string; alt: string };
  generated: boolean;
};

export const SHOWCASE: { fashion: ShowcasePair; imagination: ShowcasePair } = {
  fashion: {
    input: { src: "/samples/tee-sunset.svg", alt: "Orange pocket tee, flat lay", label: "Sample tee" },
    output: { src: "/showcase/concept-fashion.svg", alt: "The orange pocket tee on a rooftop at golden hour" },
    generated: false,
  },
  imagination: {
    input: { src: "/samples/drawing-rocket-cat.svg", alt: "Crayon doodle of a cat in a rocket", label: "Kid's sketch" },
    output: { src: "/showcase/concept-imagination.svg", alt: "Storybook illustration of a cat astronaut over a flowering moon" },
    generated: false,
  },
};
