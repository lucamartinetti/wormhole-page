.PHONY: wasm wasm-clean

WASM_CRATE = crates/wormhole-wasm
WASM_OUT = src/wormhole_web/static/wasm

wasm:
	cd $(WASM_CRATE) && wasm-pack build --target web --release
	mkdir -p $(WASM_OUT)
	cp $(WASM_CRATE)/pkg/wormhole_wasm_bg.wasm $(WASM_OUT)/
	cp $(WASM_CRATE)/pkg/wormhole_wasm.js $(WASM_OUT)/

wasm-clean:
	cd $(WASM_CRATE) && cargo clean
	rm -rf $(WASM_OUT)
