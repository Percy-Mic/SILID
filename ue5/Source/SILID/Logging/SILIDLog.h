// Shared log categories for SILID. Gameplay code never touches raw UE_LOG
// spelling — use the macros below.
//
// Doc 12 §5 (logging migration): categories become the FIRST argument via
// the _CAT macros. The no-category SILID_LOG/WARN/ERROR forms remain the
// LogSILID fallback for legacy call sites. Message standard:
// System · Actor · Id · Operation · Result.

#pragma once

#include "Logging/LogMacros.h"

// The fallback category (existing call sites).
DECLARE_LOG_CATEGORY_EXTERN(LogSILID, Log, All);

// Doc 12 §5 categories (adopted opportunistically — new code uses these).
DECLARE_LOG_CATEGORY_EXTERN(LogSILIDElectricity, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogSILIDObjectives, Log, All);

// Legacy form: category baked in (do not extend with these).
#define SILID_LOG(Format, ...)        UE_LOG(LogSILID, Log,   Format, ##__VA_ARGS__)
#define SILID_WARN(Format, ...)       UE_LOG(LogSILID, Warning, Format, ##__VA_ARGS__)
#define SILID_ERROR(Format, ...)      UE_LOG(LogSILID, Error,  Format, ##__VA_ARGS__)

// Doc 12 §5 form: category is the first argument.
#define SILID_LOG_CAT(Category, Format, ...)   UE_LOG(Category, Log,     Format, ##__VA_ARGS__)
#define SILID_WARN_CAT(Category, Format, ...)  UE_LOG(Category, Warning, Format, ##__VA_ARGS__)
#define SILID_ERROR_CAT(Category, Format, ...) UE_LOG(Category, Error,   Format, ##__VA_ARGS__)
