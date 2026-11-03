// SILID - game module. Owns every gameplay system; no editor-only code here.

using UnrealBuildTool;
using System.Collections.Generic;
using System.IO;

public class SILID : ModuleRules
{
	public SILID(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// SILID's gameplay code includes headers both from the module root and
		// by their subsystem-relative names (for example Systems/SILIDTypes.h).
		// Register each source folder so non-unity builds resolve those includes
		// the same way as the editor's unity build.
		PublicIncludePaths.Add(ModuleDirectory);
		foreach (string IncludePath in Directory.GetDirectories(ModuleDirectory))
		{
			PublicIncludePaths.Add(IncludePath);
		}

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"AIModule",
			"NavigationSystem",
			"GameplayTags",
			"UMG",
			"PhysicsCore"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore",
			"Niagara"
		});
	}
}
