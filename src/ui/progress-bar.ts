import { Container, Element, Label } from '@playcanvas/pcui';

class ProgressBar extends Container {
    private track: Element;
    private bar: Element;
    private label: Label;

    constructor(args: any = {}) {
        super({
            ...args,
            id: 'progress-bar-container',
            hidden: true
        });

        // full-width track indicating 100% range
        this.track = new Element({
            dom: 'div',
            class: 'progress-track'
        });

        this.append(this.track);

        // actual progressing bar on top of the track
        this.bar = new Element({
            dom: 'div',
            class: 'progress-bar'
        });

        this.append(this.bar);

        // percentage label
        this.label = new Label({
            class: 'progress-label'
        });
        this.label.text = '0%';

        this.append(this.label);
    }

    // Update progress in the range 0..1
    setProgress(value: number) {
        const clamped = Math.max(0, Math.min(1, value));
        // make sure at least 2% scale so user can see something
        const scale = Math.max(clamped, 0.02);
        (this.bar.dom as HTMLElement).style.transform = `translateY(-50%) scaleX(${scale})`;

        // update label text (integer %)
        this.label.text = `${Math.round(clamped * 100)}%`;
    }
}

export { ProgressBar };
