import { pipeline } from '@huggingface/transformers';

const classifier = await pipeline('image-classification', 'AdamCodd/vit-base-nsfw-detector');
const urls = [
    'data/downloads/MISS_ZENDAYA/images/2024-12-18T18-46-37_502.jpg',
    'data/downloads/MISS_ZENDAYA/images/2025-02-21T06-20-01_510.jpg',
    'data/downloads/MISS_ZENDAYA/images/2025-02-24T09-51-01_515.jpg'
];
const output = await classifier(urls);
console.log(output);
// [
//   [
//     { label: 'nsfw', score: 0.9970526099205017 },
//     { label: 'sfw', score: 0.002947381464764476 }
//   ],
//   [
//     { label: 'nsfw', score: 0.9737256169319153 },
//     { label: 'sfw', score: 0.02627435512840748 }
//   ],
//   [
//     { label: 'nsfw', score: 0.9589488506317139 },
//     { label: 'sfw', score: 0.041051171720027924 }
//   ]
// ]
