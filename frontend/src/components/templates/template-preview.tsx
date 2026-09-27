"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { MAX_LIMIT, filterParam } from "@/lib/list-query";
import { useSettings, useTournamentOptions } from "@/lib/queries";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { Participation, RenderInput, RenderedPreview, Team } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button, Spinner } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const PREVIEW_DEBOUNCE_MS = 600;
const T = {
  title: "Live preview",
  team: "Preview for team",
  sample: "Sample data",
  sendTest: "Send test to me",
  sent: "Test email sent to your address.",
  subject: "Subject",
  plain: "Plain-text version",
  empty: "Start typing a subject and body to see the preview.",
  tournament: "Preview with tournament",
  noTournament: "None (sample values)",
  tournamentHint: "Fills {{tournament.…}} placeholders with this tournament’s data and variables.",
  participation: "Participation (optional)",
  allTeams: "No specific team (tournament values only)",
  participationHint: "Uses this team’s data and its variable overrides.",
  missingTitle: (keys: string) => `Missing variables: ${keys}`,
  missing: "Emails using these variables cannot be sent or copied until a value is set on the tournament (or for the team).",
};

interface Props {
  subject: string;
  bodyHtml: string;
  teams: Team[];
  /** Show the "Preview with tournament" / participation selects (template editor). */
  tournamentSelect?: boolean;
}

export function TemplatePreview({ subject, bodyHtml, teams, tournamentSelect = false }: Props) {
  const toast = useToast();
  const [teamId, setTeamId] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [participationId, setParticipationId] = useState("");
  const [sending, setSending] = useState(false);
  const settings = useSettings();
  // Without a configured mailbox the test-send endpoint returns 409, so hide the button.
  const canSendTest = settings.data?.automaticSendingAvailable !== false;
  const input: RenderInput = {
    subject,
    bodyHtml,
    teamId: participationId ? undefined : teamId || undefined,
    tournamentId: tournamentId || undefined,
    participationId: participationId || undefined,
  };
  const debounced = useDebouncedValue(input, PREVIEW_DEBOUNCE_MS);
  const hasContent = debounced.subject.trim() !== "" || debounced.bodyHtml.trim() !== "";
  const preview = useApi(hasContent ? `preview:${JSON.stringify(debounced)}` : null, () =>
    api.post<RenderedPreview>("/templates/preview", debounced),
  );

  async function sendTest() {
    setSending(true);
    try {
      await api.post("/templates/test-send", input);
      toast.show(T.sent);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="preview-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="preview-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {T.title}
          {preview.loading && <Spinner className="text-slate-500" />}
        </h2>
        {canSendTest && (
          <Button variant="secondary" size="sm" onClick={sendTest} loading={sending} disabled={!hasContent}>
            {T.sendTest}
          </Button>
        )}
      </div>
      {tournamentSelect && (
        <TournamentSelect
          value={tournamentId}
          onChange={(id) => {
            setTournamentId(id);
            setParticipationId("");
          }}
        />
      )}
      {tournamentId && <ParticipationSelect tournamentId={tournamentId} value={participationId} onChange={setParticipationId} />}
      {!participationId && (
        <SelectField label={T.team} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">{T.sample}</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      )}
      {!hasContent && <p className="text-sm text-slate-600">{T.empty}</p>}
      {preview.error && <ErrorAlert error={preview.error} />}
      {preview.data && hasContent && (
        <div className="space-y-2">
          {(debounced.tournamentId || debounced.participationId) && (preview.data.missingVariables ?? []).length > 0 && (
            <Alert tone="warning" title={T.missingTitle((preview.data.missingVariables ?? []).join(", "))}>
              {T.missing}
            </Alert>
          )}
          <p className="rounded-md bg-background-card px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{T.subject}: </span>
            <span className="text-slate-900">{preview.data.subject}</span>
          </p>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.data.html}
            className="h-[28rem] w-full rounded-md border border-slate-200 bg-white"
          />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">{T.plain}</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-background-card p-3 text-xs text-slate-800">
              {preview.data.text}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

function TournamentSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const tournaments = useTournamentOptions();
  return (
    <SelectField
      label={T.tournament}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={tournaments.error ? errorMessage(tournaments.error) : T.tournamentHint}
      disabled={tournaments.loading && !tournaments.data}
    >
      <option value="">{T.noTournament}</option>
      {(tournaments.data ?? []).map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </SelectField>
  );
}

function ParticipationSelect({ tournamentId, value, onChange }: { tournamentId: string; value: string; onChange: (id: string) => void }) {
  const participations = useApi(`preview-participations:${tournamentId}`, () =>
    api.get<Participation[]>("/participations", { [filterParam("tournament")]: tournamentId, limit: MAX_LIMIT, sort: "team" }),
  );
  return (
    <SelectField
      label={T.participation}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={participations.error ? errorMessage(participations.error) : T.participationHint}
      disabled={participations.loading && !participations.data}
    >
      <option value="">{T.allTeams}</option>
      {(participations.data ?? []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.team.name}
          {p.ageGroup ? ` (${p.ageGroup})` : ""}
        </option>
      ))}
    </SelectField>
  );
}
