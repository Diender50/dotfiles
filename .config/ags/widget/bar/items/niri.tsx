import AstalNiri from "gi://AstalNiri";
import { Gdk } from "ags/gtk4";
import { createBinding, For } from "ags";

const niri = AstalNiri.get_default();

function WorkspaceButton({ ws }: { ws: AstalNiri.Workspace }) {
   const classNames = createBinding(niri, "focusedWorkspace").as((fws) => {
      const classes = ["workspace"];
      const active = fws?.id == ws.id;
      if (active) {
         classes.push("active");
      }
      return classes;
   });

   return (
      <button cssClasses={classNames} onClicked={() => ws.focus()}>
         <label class={"workspace-label"} label={ws.idx.toString()} />
      </button>
   );
}

function Workspaces({ output }: { output: AstalNiri.Output }) {
   const workspaces = createBinding(output, "workspaces").as((workspaces) =>
      workspaces.sort((a, b) => a.id - b.id),
   );

   return (
      <box spacing={4} class={"workspaces"}>
         <For each={workspaces}>
            {(ws) => <WorkspaceButton ws={ws} />}
         </For>
      </box>
   );
}

export function NiriWorkspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
   const outputs = createBinding(niri, "outputs").as((outputs) =>
      outputs.filter((output) => output.model === gdkmonitor.model),
   );

   return (
      <box class="workspaces">
         <For each={outputs}>
            {(output) => <Workspaces output={output} />}
         </For>
      </box>
   );
}
