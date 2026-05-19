extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/overview_summary_panel.gd")
	if panel == null:
		_fail("Main scene does not expose OverviewSummaryPanel")
		return
	if not panel.has_method("set_summary") or not panel.has_method("set_runtime_snapshot") or not panel.has_method("visible_text"):
		_fail("OverviewSummaryPanel does not expose required summary APIs")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var factions_before: int = _array(game_state.get("factions")).size()
	var factions: Array = _array(game_state.get("factions")).duplicate(true)
	factions.append({
		"id": "overview-panel-count-test",
		"name": "概览面板测试势力",
		"type": "测试",
		"leader": "测试首领",
		"capital": "测试地"
	})
	game_state.set("factions", factions)
	game_state.set("huangquan", 43.0)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var live_labels: Dictionary = _dict(panel.get("live_summary_value_labels"))
	var factions_label: Label = live_labels.get("factions_count", null) as Label
	var huangquan_label: Label = live_labels.get("huangquan", null) as Label
	if factions_label == null or huangquan_label == null:
		_fail("OverviewSummaryPanel did not expose live summary labels")
		return
	if str(factions_label.text) != "%d 个" % (factions_before + 1):
		_fail("OverviewSummaryPanel faction count stayed stale")
		return
	if str(huangquan_label.text) != "43":
		_fail("OverviewSummaryPanel authority metric stayed stale")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("%d 个" % (factions_before + 1)) or not text.contains("皇权") or not text.contains("43"):
		_fail("OverviewSummaryPanel visible text did not include live values")
		return

	print("[TianmingGodotTest] overview summary panel main scene test passed")
	_finish(0)

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] overview summary panel main scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] overview summary panel main scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
