import { pipeline } from '@huggingface/transformers';

const classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224');
const urls = [
    // 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg',
    // 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg',
    'data/thumbs/6c79932a6a57dcc63894f2fa91e39fd7.webp'
];
const output = await classifier(urls);
console.log(output);
// [
//   [
//     { label: 'tiger, Panthera tigris', score: 0.5794005393981934 },
//     { label: 'tiger cat', score: 0.4167880117893219 },
//     {
//       label: 'lion, king of beasts, Panthera leo',
//       score: 0.0005233726114965975
//     },
//     {
//       label: 'jaguar, panther, Panthera onca, Felis onca',
//       score: 0.0003852022346109152
//     },
//     { label: 'lynx, catamount', score: 0.0002925566222984344 }
//   ],
//   [
//     { label: 'Egyptian cat', score: 0.8137072920799255 },
//     { label: 'tabby, tabby cat', score: 0.12181729823350906 },
//     { label: 'tiger cat', score: 0.05148308724164963 },
//     { label: 'lynx, catamount', score: 0.006738707423210144 },
//     { label: 'Siamese cat, Siamese', score: 0.0006487044156529009 }
//   ]
// ]
