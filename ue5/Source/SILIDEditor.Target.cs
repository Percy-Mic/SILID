// SILID - first-person psychological horror. Editor target.

using UnrealBuildTool;
using System.Collections.Generic;

public class SILIDEditorTarget : TargetRules
{
	public SILIDEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("SILID");
	}
}
