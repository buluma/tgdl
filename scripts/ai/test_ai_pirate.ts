
import { runIndexScan } from '../../src/core/ai/manager.js';
import { getDb } from '../../src/core/db.js';
import path from 'path';

async function insertDownload(imagePath) {
    const db = getDb();
    const fileName = path.basename(imagePath);
    const stats = {
        groupId: 'test-group',
        messageId: String(Date.now()),
        fileName: fileName,
        fileSize: 373164,
        filePath: imagePath,
        fileType: 'photo',
        createdAt: new Date(),
    };
    const result = db.prepare(
        'INSERT INTO downloads (group_id, message_id, file_name, file_size, file_path, file_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(stats.groupId, stats.messageId, stats.fileName, stats.fileSize, stats.filePath, stats.fileType, stats.createdAt.toISOString());
    return result.lastInsertRowid;
}

async function testAi() {
    const imagePath = 'data/downloads/pirate.jpg';
    const downloadId = await insertDownload(imagePath);

    console.log('Starting AI test...');
    console.log(`Found downloadId: ${downloadId} for image: ${imagePath}`);

    // Define a config with all AI features enabled
    const config = {
        enabled: true,
        embeddings: { enabled: true, model: 'Xenova/clip-vit-base-patch32' },
        faces: { enabled: true, model: 'Xenova/yolos-tiny', epsilon: 0.55, minPoints: 3 },
        tags: { enabled: true, model: 'Xenova/vit-base-patch16-224', topK: 5 },
        phash: { enabled: true },
        indexConcurrency: 1,
        batchSize: 1,
        fileTypes: ['photo'],
    };

    console.log('Running AI index scan...');
    await runIndexScan(config);
    console.log('AI index scan finished.');

    // Verify the results
    console.log('Verifying results...');

    const db = getDb();
    const phashResult = db.prepare('SELECT phash FROM downloads WHERE id = ?').get(downloadId);
    const embeddingResult = db.prepare('SELECT * FROM image_embeddings WHERE download_id = ?').get(downloadId);
    const facesResult = db.prepare('SELECT * FROM faces WHERE download_id = ?').all(downloadId);
    const tagsResult = db.prepare('SELECT * FROM image_tags WHERE download_id = ?').all(downloadId);

    let success = true;

    if (phashResult && phashResult.phash) {
        console.log('✅ pHash generated successfully.');
    } else {
        console.error('❌ pHash generation failed.');
        success = false;
    }

    if (embeddingResult) {
        console.log('✅ Embedding generated successfully.');
    } else {
        console.error('❌ Embedding generation failed.');
        success = false;
    }

    if (facesResult && facesResult.length > 0) {
        console.log(`✅ Face detection found ${facesResult.length} faces.`);
    } else {
        // This is not necessarily a failure, as the image might not contain faces
        console.log('⚪️ Face detection did not find any faces.');
    }

    if (tagsResult && tagsResult.length > 0) {
        console.log(`✅ Image tagging generated ${tagsResult.length} tags:`);
        for (const tag of tagsResult) {
            console.log(`  - ${tag.tag} (score: ${tag.score.toFixed(2)})`);
        }
    } else {
        console.error('❌ Image tagging failed.');
        success = false;
    }

    console.log('------------------');
    if (success) {
        console.log('🎉 AI test completed successfully!');
    } else {
        console.error('🔥 AI test failed.');
    }
    console.log('------------------');
}

testAi().catch(err => {
    console.error('An unexpected error occurred during the test:');
    console.error(err);
});
