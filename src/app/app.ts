import { Component, computed, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatToolbar } from '@angular/material/toolbar';

interface RecipeVariable {
  name: string;
  comment: string | null;
  fieldType: VariableFieldType;
  defaultValue: string;
  required: boolean;
}

interface HeaderMetadata {
  comment: string | null;
  fieldType: VariableFieldType;
  defaultValue: string;
  required: boolean;
}

interface RenderedRecipeSegment {
  text: string;
  replaced: boolean;
}

type VariableFieldType = 'input' | 'textarea';

@Component({
  selector: 'app-root',
  imports: [
    MatButton,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatToolbar,
    MatLabel
],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App {
  protected readonly recipeText = signal('');
  protected readonly variableValues = signal<Record<string, string>>({});
  protected readonly copyButtonLabel = signal('Copy');

  protected readonly variables = computed<RecipeVariable[]>(() => {
    const recipe = this.recipeText();
    const headerMetadata = this.extractHeaderMetadata(recipe);
    const names = new Set<string>();
    const variables: RecipeVariable[] = [];
    const variablePattern = /\$\{([^}]+)\}\$/g;

    for (const match of recipe.matchAll(variablePattern)) {
      const name = match[1].trim();

      if (!name || names.has(name)) {
        continue;
      }

      names.add(name);
      const metadata = headerMetadata.get(name);
      variables.push({
        name,
        comment: metadata?.comment ?? null,
        fieldType: metadata?.fieldType ?? 'input',
        defaultValue: metadata?.defaultValue ?? '',
        required: metadata?.required ?? true
      });
    }

    return variables;
  });

  protected readonly renderedRecipe = computed(() => {
    return this.renderedRecipeSegments()
      .map((segment) => segment.text)
      .join('');
  });

  protected readonly renderedRecipeSegments = computed<RenderedRecipeSegment[]>(() => {
    const values = this.variableValues();
    const variablesByName = new Map(this.variables().map((variable) => [variable.name, variable]));
    const segments: RenderedRecipeSegment[] = [];
    const variablePattern = /\$\{([^}]+)\}\$/g;
    let previousIndex = 0;

    for (const match of this.recipeText().matchAll(variablePattern)) {
      const matchIndex = match.index;

      if (matchIndex > previousIndex) {
        segments.push({
          text: this.recipeText().slice(previousIndex, matchIndex),
          replaced: false
        });
      }

      const name = match[1].trim();
      const variable = variablesByName.get(name);

      segments.push({
        text: values[name] ?? variable?.defaultValue ?? '',
        replaced: true
      });
      previousIndex = matchIndex + match[0].length;
    }

    if (previousIndex < this.recipeText().length) {
      segments.push({
        text: this.recipeText().slice(previousIndex),
        replaced: false
      });
    }

    return segments;
  });

  protected readonly missingRequiredVariables = computed(() => {
    const values = this.variableValues();

    return this.variables()
      .filter((variable) => variable.required && !(values[variable.name] ?? variable.defaultValue).trim())
      .map((variable) => variable.name);
  });

  protected updateRecipe(event: Event): void {
    this.recipeText.set(this.readControlValue(event));
    this.copyButtonLabel.set('Copy');
  }

  protected updateVariableValue(name: string, event: Event): void {
    const value = this.readControlValue(event);

    this.variableValues.update((values) => ({
      ...values,
      [name]: value
    }));
    this.copyButtonLabel.set('Copy');
  }

  protected async copyRenderedRecipe(): Promise<void> {
    await navigator.clipboard.writeText(this.renderedRecipe());
    this.copyButtonLabel.set('Copied');
  }

  private extractHeaderMetadata(recipe: string): Map<string, HeaderMetadata> {
    const metadata = new Map<string, HeaderMetadata>();

    for (const line of recipe.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('-')) {
        continue;
      }

      const headerContent = trimmedLine.replace(/^(?:\/\/|#|-)\s*/, '');
      const headerMatch = headerContent.match(/^([^:]+):\s*(.+)$/);

      if (!headerMatch) {
        continue;
      }

      const name = headerMatch[1].trim();
      const metadataTags = this.extractMetadataTags(headerMatch[2].trim());

      metadata.set(name, {
        comment: metadataTags.comment || null,
        fieldType: metadataTags.tags.has('@textarea') ? 'textarea' : 'input',
        defaultValue: metadataTags.defaultValue,
        required: !metadataTags.tags.has('@optional')
      });
    }

    return metadata;
  }

  private extractMetadataTags(commentWithTags: string): { comment: string; tags: Set<string>; defaultValue: string } {
    const tags = new Set<string>();
    let defaultValue = '';
    let comment = commentWithTags;
    const defaultTagPattern = /(?:^|\s)@default:(?:(?:text:)?"([^"]*)"|(\S+))/i;
    const defaultMatch = comment.match(defaultTagPattern);

    if (defaultMatch) {
      defaultValue = defaultMatch[1] ?? defaultMatch[2] ?? '';
      comment = comment.replace(defaultTagPattern, '');
    }

    comment = comment.replace(/(?:^|\s)@\w+/g, (tag) => {
      tags.add(tag.trim().toLowerCase());
      return '';
    });

    return {
      comment: comment.trim(),
      tags,
      defaultValue
    };
  }

  private readControlValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
