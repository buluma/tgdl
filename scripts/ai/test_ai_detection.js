import { pipeline } from "@huggingface/transformers";

const detector = await pipeline("object-detection", "Xenova/yolos-tiny");

const image = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg";
const output = await detector(image, { threshold: 0.9 });
console.log(output);
// [
//   {
//     score: 0.9219624996185303,
//     label: 'cat',
//     box: { xmin: 80, ymin: 36, xmax: 560, ymax: 396 }
//   }
// ]
