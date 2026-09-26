import { notFound } from 'next/navigation';
import { getMember, publishedProjectTitles } from '@/lib/admin/db';
import { deleteMemberAction, regenerateCardAction, removeMemberPhotoAction, saveMemberAction } from '../../actions';
import { ActionButton, ActionForm, Submit } from '../../ui';
import { ImageManager } from '../../projects/[id]/image-manager';

const parse = (s: string): string[] => { try { return JSON.parse(s); } catch { return []; } };

export default async function EditMember({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMember(id);
  if (!m) notFound();
  const projects = await publishedProjectTitles();

  return (
    <>
      <p><a className="text-link" href="/admin/team">All people</a></p>
      <h1 className="type-h2">{m.name}</h1>
      <div className="admin-actions admin-lead">
        <span className="pill">{m.id_code} · card v{m.card_version}</span>
        <a className="btn btn-ghost btn-sm" href={`/team/${m.slug}`} target="_blank" rel="noopener">Open portfolio</a>
        <ActionButton action={regenerateCardAction.bind(null, id)}>Regenerate ID card</ActionButton>
      </div>

      <section className="admin-section" aria-labelledby="photo-h">
        <h2 id="photo-h" className="type-h3">Photo</h2>
        <p className="admin-lead">A square-ish portrait, face centred, about 800 px. It appears on every card. Paste or choose one; it replaces the current photo.</p>
        {m.photo_key && (
          <div className="thumb" style={{ maxWidth: 240, marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
            <img src={`/media/${m.photo_key}?v=${m.card_version}`} alt={`${m.name}’s current photo`} />
            <form action={removeMemberPhotoAction.bind(null, id)}><button className="btn btn-ghost btn-sm btn-danger">Remove photo</button></form>
          </div>
        )}
        <ImageManager memberId={id} altHint={`Portrait of ${m.name}`} />
      </section>

      <section className="admin-section" aria-labelledby="details-h">
        <h2 id="details-h" className="type-h3">Details</h2>
        <ActionForm action={saveMemberAction.bind(null, id)} className="admin-form">
          <div className="admin-grid">
            <label className="field"><span>Name</span><input name="name" defaultValue={m.name} required maxLength={80} /></label>
            <label className="field"><span>Role</span><input name="role" defaultValue={m.role} required maxLength={80} placeholder="Design and front end" /></label>
            <label className="field"><span>Slug <small>(/team/…)</small></span><input name="slug" defaultValue={m.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
            <label className="field"><span>ID code</span><input name="id_code" defaultValue={m.id_code} required pattern="LF-\d{3}" /></label>
            <label className="field"><span>Monogram <small>(until there is a photo)</small></span><input name="initials" defaultValue={m.initials ?? ''} maxLength={3} /></label>
            <label className="field"><span>Favourite build <small>(on the card back)</small></span>
              <select name="favorite_project_id" defaultValue={m.favorite_project_id ?? ''}>
                <option value="">None yet</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select></label>
            <label className="field"><span>Currently building <small>(on the ID card; keep it true, blank hides it)</small></span><input name="building" defaultValue={m.building ?? ''} maxLength={60} placeholder="a clinic booking app" /></label>
            <label className="field"><span>Skills <small>(comma separated, up to 6, on the card)</small></span><input name="skills" defaultValue={parse(m.skills).join(', ')} /></label>
            <label className="field"><span>Tools <small>(comma separated, portfolio page)</small></span><input name="tools" defaultValue={parse(m.tools).join(', ')} /></label>
            <label className="field"><span>LinkedIn</span><input name="linkedin_url" type="url" defaultValue={m.linkedin_url ?? ''} placeholder="https://" /></label>
            <label className="field"><span>GitHub</span><input name="github_url" type="url" defaultValue={m.github_url ?? ''} placeholder="https://" /></label>
            <label className="field"><span>Website</span><input name="website_url" type="url" defaultValue={m.website_url ?? ''} placeholder="https://" /></label>
          </div>
          <label className="field"><span>Bio <small>(60–120 words, first person)</small></span><textarea name="bio" defaultValue={m.bio} required maxLength={1200} rows={6} /></label>
          <div><Submit>Save</Submit></div>
        </ActionForm>
      </section>

      <section className="admin-section" aria-labelledby="danger-h">
        <h2 id="danger-h" className="type-h3">Remove</h2>
        <form action={deleteMemberAction.bind(null, id)} className="admin-form">
          <label className="admin-check"><input type="checkbox" name="confirm" required /> Remove {m.name}, their ID card and photo from the site</label>
          <div><button className="btn btn-ghost btn-danger">Remove this person</button></div>
        </form>
      </section>
    </>
  );
}
