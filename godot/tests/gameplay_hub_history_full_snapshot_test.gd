extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	game_state.set("action_history", _named_history(5, "action-history-sentinel"))
	game_state.set("issued_edicts", _named_history(3, "edict-history-sentinel"))
	game_state.set("diplomacy_history", _named_history(3, "diplomacy-history-sentinel"))

	var snapshot: Dictionary = game_state.call("gameplay_hub_snapshot", false)
	var history_text: String = str(snapshot.get("history", ""))
	for needle in [
		"action-history-sentinel-0",
		"edict-history-sentinel-0",
		"diplomacy-history-sentinel-0",
	]:
		if not history_text.contains(needle):
			_fail("Gameplay hub snapshot omitted older history: %s" % needle)
			return

	print("[TianmingGodotTest] gameplay hub history full-snapshot scene test passed")
	_finish(0)

func _named_history(count: int, prefix: String) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({"turn": i + 1, "name": "%s-%d" % [prefix, i]})
	return rows

func _fail(message: String) -> void:
	print("[TianmingGodotTest] gameplay hub history full-snapshot scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] gameplay hub history full-snapshot scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
