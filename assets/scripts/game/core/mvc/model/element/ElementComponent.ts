import { EComponentType, IComponent } from "../entity/ComponentType";

export class ElementComponent implements IComponent {
    readonly type: EComponentType = EComponentType.elements;

}


