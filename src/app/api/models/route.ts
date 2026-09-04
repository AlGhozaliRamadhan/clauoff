import { NextResponse } from 'next/server';
import { getBackend } from '@/lib/backend-config';
import { readStoredConfig, setActiveProfileId } from '@/lib/api-profiles';

export const runtime = 'nodejs';

function getProfileMetadata() {
  const stored = readStoredConfig();
  const activeProfile =
    stored.profiles.find((p) => p.id === stored.activeId) ?? stored.profiles[0] ?? null;

  const profiles = stored.profiles.map((p) => ({
    id: p.id,
    name: p.name,
    backendUrl: p.backendUrl,
    defaultModel: p.defaultModel,
    imageModel: p.imageModel ?? "",
    isActive: activeProfile ? p.id === activeProfile.id : false,
  }));

  return {
    activeProfile: activeProfile
      ? {
          id: activeProfile.id,
          name: activeProfile.name,
          backendUrl: activeProfile.backendUrl,
          defaultModel: activeProfile.defaultModel,
          imageModel: activeProfile.imageModel ?? "",
        }
      : null,
    profiles,
  };
}

export async function GET() {
  const { activeProfile, profiles } = getProfileMetadata();

  try {
    const models = await getBackend().listModels();
    return NextResponse.json({
      models,
      connected: true,
      activeProfile,
      profiles,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to connect to backend.';
    return NextResponse.json(
      {
        error: message,
        models: [],
        connected: false,
        activeProfile,
        profiles,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  let body: { activeId?: string; activeProfileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const targetId = body.activeId || body.activeProfileId;
  if (!targetId) {
    return NextResponse.json({ error: 'activeId or activeProfileId is required.' }, { status: 400 });
  }

  const switched = setActiveProfileId(targetId);
  if (!switched) {
    return NextResponse.json({ error: `Profile not found: ${targetId}` }, { status: 404 });
  }

  const { activeProfile, profiles } = getProfileMetadata();

  try {
    const models = await getBackend().listModels();
    return NextResponse.json({
      ok: true,
      connected: true,
      activeProfile,
      profiles,
      models,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to connect to activated profile backend.';
    return NextResponse.json({
      ok: true,
      connected: false,
      error: message,
      activeProfile,
      profiles,
      models: [],
    });
  }
}
