import fs from 'fs';
import path from 'path';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cjVigY5qzO86Huf0OWal';

console.log('--- ELEVENLABS CONNECTION TEST ---');
console.log(`Using Key: ...${ELEVENLABS_API_KEY.slice(-6)}`);
console.log(`Using Voice ID: ${ELEVENLABS_VOICE_ID}`);

if (!ELEVENLABS_API_KEY) {
  console.error('Error: ELEVENLABS_API_KEY is not configured in .env');
  process.exit(1);
}

async function testElevenLabs() {
  try {
    // 1. Fetch User / Subscription details to verify key validity and balance
    console.log('\n1. Verifying API Key and subscription limits...');
    const userRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      if (userRes.status === 401 && errText.includes('missing_permissions')) {
        console.log('⚠️ API Key does not have permission to read subscription info (user_read), but it might still be fully capable of generating audio! Continuing test...');
      } else {
        console.error(`❌ API Key check failed! ElevenLabs responded with code: ${userRes.status}`);
        console.error(errText);
        return;
      }
    } else {
      const userData = await userRes.json();
      console.log('✅ API Key is VALID!');
      console.log(`   - Tier: ${userData.tier}`);
      console.log(`   - Characters used: ${userData.character_count} / ${userData.character_limit}`);
      console.log(`   - Remaining: ${userData.character_limit - userData.character_count} characters`);
    }

    // 2. Verify Voice ID
    console.log('\n2. Verifying Voice ID...');
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/voices/${ELEVENLABS_VOICE_ID}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    if (!voiceRes.ok) {
      const errText = await voiceRes.text();
      console.error(`❌ Voice ID "${ELEVENLABS_VOICE_ID}" is INVALID or not accessible!`);
      console.error(errText);
      
      console.log('\n🔍 Fetching all available voices in your account to help you find the right one...');
      try {
        const allVoicesRes = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        
        if (allVoicesRes.ok) {
          const allVoicesData = await allVoicesRes.json();
          console.log(`\n📋 Found ${allVoicesData.voices?.length || 0} voices in your account:`);
          if (allVoicesData.voices && allVoicesData.voices.length > 0) {
            allVoicesData.voices.forEach((v) => {
              console.log(`   - Name: "${v.name}" | ID: ${v.voice_id} | Category: ${v.category} | Language: ${v.labels?.language || 'N/A'}`);
            });
          } else {
            console.log('   (No custom voices found on this account yet. You can use standard ElevenLabs voice IDs)');
          }
        } else {
          console.error(`❌ Failed to list voices: ${allVoicesRes.status}`);
        }
      } catch (listErr) {
        console.error('❌ Error listing voices:', listErr.message);
      }
      return;
    }

    const voiceData = await voiceRes.json();
    console.log(`✅ Voice ID is VALID!`);
    console.log(`   - Voice Name: ${voiceData.name}`);
    console.log(`   - Category: ${voiceData.category}`);
    console.log(`   - Gender: ${voiceData.labels?.gender || 'N/A'}`);
    console.log(`   - Accent/Language: ${voiceData.labels?.accent || voiceData.labels?.language || 'N/A'}`);

    // 3. Test simple audio synthesis
    console.log('\n3. Synthesizing a small Arabic Egyptian test phrase...');
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'يا باشا كله تمام والخدمة شغالة يا كبير بصوت مصري طبيعي',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.38,
          similarity_boost: 0.8,
          style: 0.7,
          use_speaker_boost: true
        }
      })
    });

    if (ttsRes.ok) {
      const buffer = await ttsRes.arrayBuffer();
      console.log(`✅ TTS Generation SUCCESSFUL! Generated ${buffer.byteLength} bytes of high-quality Arabic audio.`);
    } else {
      const errText = await ttsRes.text();
      console.error(`❌ TTS Generation FAILED!`);
      console.error(errText);
    }

  } catch (err) {
    console.error('❌ Network error connecting to ElevenLabs:', err.message);
  }
}

testElevenLabs();
