extends Node

const MAIN_SCRIPT_PATH := "res://scripts/main.gd"

const FORBIDDEN_MARKERS := [
	"func _add_row(",
	"func _summary_metric_key_for_row(",
	"func _summary_metric_key(",
	"func _add_runtime_bar(",
	"func _make_runtime_label(",
	"var runtime_date_label",
	"var runtime_treasury_label",
	"var runtime_neitang_label",
	"var runtime_authority_label",
	"var runtime_population_label",
	"var runtime_report_label",
	"var live_summary_value_labels",
	"var overview_summary_row_count",
	"func _sync_overview_summary_compat(",
	"func _refresh_live_summary_rows(",
	"鍥",
	"閾",
	"鐨"
]

func _ready() -> void:
	var file := FileAccess.open(MAIN_SCRIPT_PATH, FileAccess.READ)
	if file == null:
		_fail("Could not read main.gd")
		return
	var source: String = file.get_as_text()
	for marker in FORBIDDEN_MARKERS:
		if source.contains(str(marker)):
			_fail("Main scene still contains legacy overview marker: %s" % str(marker))
			return
	print("[TianmingGodotTest] main no legacy overview scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] main no legacy overview scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] main no legacy overview scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
