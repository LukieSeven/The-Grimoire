import type { ComponentProps } from "react";
import { AbilityBuilder } from "./ability-builder";

type Props = ComponentProps<typeof AbilityBuilder> & { characterName: string };

export function EditAbilitiesDialog(props: Props) {
  return <AbilityBuilder {...props} />;
}
