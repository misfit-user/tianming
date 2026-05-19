extends Node

const TitleScene := preload("res://scenes/title.tscn")
const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const SaveManagerScript := preload("res://scripts/save_manager.gd")

var save_manager: RefCounted

func _ready() -> void:
	save_manager = SaveManagerScript.new()
	save_manager.call("delete_slot", "quick")

	var title: Node = TitleScene.instantiate()
	add_child(title)
	await get_tree().process_frame

	if not title.has_method("start_new_game") or not title.has_method("continue_game"):
		_fail("Title screen does not expose start_new_game and continue_game")
		return
	if title.has_method("has_continue_save") and bool(title.call("has_continue_save")):
		_fail("Title screen reported a continue save before one existed")
		return

	var new_result: Dictionary = title.call("start_new_game")
	await get_tree().process_frame
	if not new_result.get("ok", false):
		_fail("Title screen new game failed: %s" % str(new_result.get("error", "")))
		return
	var new_main: Node = title.get("current_main") as Node
	if new_main == null:
		_fail("Title screen did not create a main game instance")
		return
	var new_state: RefCounted = new_main.get("game_state") as RefCounted
	if new_state == null or int(new_state.get("turn")) != 1:
		_fail("Title screen new game did not start on turn 1")
		return
	title.call("return_to_title")
	await get_tree().process_frame

	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	var saved_state: RefCounted = GameStateScript.new()
	saved_state.call("load_from_scenario_result", load_result)
	saved_state.call("advance_month")
	save_manager.call("save_to_slot", saved_state, "quick")
	var saved_turn: int = int(saved_state.get("turn"))
	title.call("refresh_continue_state")
	await get_tree().process_frame
	if title.has_method("has_continue_save") and not bool(title.call("has_continue_save")):
		_fail("Title screen did not detect the prepared quick save")
		return

	var continue_result: Dictionary = title.call("continue_game")
	await get_tree().process_frame
	if not continue_result.get("ok", false):
		_fail("Title screen continue failed: %s" % str(continue_result.get("error", "")))
		return
	var continued_main: Node = title.get("current_main") as Node
	if continued_main == null:
		_fail("Title screen did not create a continued main game instance")
		return
	var continued_state: RefCounted = continued_main.get("game_state") as RefCounted
	if continued_state == null or int(continued_state.get("turn")) != saved_turn:
		_fail("Title screen continue did not restore the saved turn")
		return

	save_manager.call("delete_slot", "quick")
	print("[TianmingGodotTest] title screen flow scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _fail(message: String) -> void:
	if save_manager != null:
		save_manager.call("delete_slot", "quick")
	print("[TianmingGodotTest] title screen flow scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] title screen flow scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
