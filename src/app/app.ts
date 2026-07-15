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
}

interface HeaderMetadata {
  comment: string | null;
  fieldType: VariableFieldType;
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
        fieldType: metadata?.fieldType ?? 'input'
      });
    }

    return variables;
  });

  protected readonly renderedRecipe = computed(() => {
    const values = this.variableValues();

    return this.recipeText().replace(/\$\{([^}]+)\}\$/g, (_match, variableName: string) => {
      return values[variableName.trim()] ?? '';
    });
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
      const commentWithTags = headerMatch[2].trim();
      const tags = new Set(commentWithTags.match(/@\w+/g)?.map((tag) => tag.toLowerCase()) ?? []);
      const comment = commentWithTags.replace(/\s*@\w+/g, '').trim();

      metadata.set(name, {
        comment: comment || null,
        fieldType: tags.has('@textarea') ? 'textarea' : 'input'
      });
    }

    return metadata;
  }

  private readControlValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
