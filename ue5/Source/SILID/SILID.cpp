// SILID module: implements the game's gameplay systems.
// Everything gameplay lives here; keep it free of editor-only code.

#include "SILID.h"
#include "Modules/ModuleManager.h"
#include "Logging/SILIDLog.h"

IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, SILID, "SILID");

// Log categories (see Logging/SILIDLog.h). LogSILID is the fallback; the
// doc 12 §5 categories are added here as systems adopt them.
DEFINE_LOG_CATEGORY(LogSILID);
DEFINE_LOG_CATEGORY(LogSILIDElectricity);
DEFINE_LOG_CATEGORY(LogSILIDObjectives);
